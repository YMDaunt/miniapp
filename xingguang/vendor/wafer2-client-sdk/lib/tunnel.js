var wxTunnel = require('./wxTunnel')

/**
 * 当前打开的信道，同一时间只能有一个信道打开
 */
var currentTunnel = null;

// 信道状态枚举
var STATUS_CLOSED = Tunnel.STATUS_CLOSED = 'CLOSED';
var STATUS_CONNECTING = Tunnel.STATUS_CONNECTING = 'CONNECTING';
var STATUS_ACTIVE = Tunnel.STATUS_ACTIVE = 'ACTIVE';
var STATUS_RECONNECTING = Tunnel.STATUS_RECONNECTING = 'RECONNECTING';

// 错误类型枚举
var ERR_CONNECT_SERVICE = Tunnel.ERR_CONNECT_SERVICE = 1001;
var ERR_CONNECT_SOCKET = Tunnel.ERR_CONNECT_SOCKET = 1002;
var ERR_RECONNECT = Tunnel.ERR_RECONNECT = 2001;
var ERR_SOCKET_ERROR = Tunnel.ERR_SOCKET_ERROR = 3001;


// 断线重连最多尝试 5 次
var DEFAULT_MAX_RECONNECT_TRY_TIMES = 5;

// 每次重连前，等待时间的增量值
var DEFAULT_RECONNECT_TIME_INCREASE = 1000;

var isReLogin = false // 是否是因为重复登录造成的socket关闭，此时不进行重连
var isModeratorOnTi = false

/**
 * @description 信道函数
 * @author smy
 * @date 2018-10-10
 * @param {*} socketUrl 更改为请求连接的socketurl，原官方为后台服务地址，请求此后台地址才拿到连接的socketurl
 * // 监听信道内置消息，包括 connect/close/reconnecting/reconnect/error和msg(发送消息到公屏)
 */
function Tunnel(socketUrl) {
    console.log('开始初始化tunnel对象')
    if (currentTunnel && currentTunnel.status !== STATUS_CLOSED) {
        throw new Error('当前有未关闭的信道，请先关闭之前的信道，再打开新信道');
    }

    currentTunnel = this;

    // 等确认微信小程序全面支持 ES6 就不用那么麻烦了
    var me = this;

    //=========================================================================
    // 暴露实例状态以及方法
    //=========================================================================
    this.socketUrl = socketUrl;
    this.status = null;

    this.open = openConnect;
    this.on = registerEventHandler;
    /**
     * 发送消息
     * this.tunnel.emit('sendMsg', { "msg": msg, "private": false });
     */
    this.emit = emitMessagePacket;
    this.close = close;

    this.isClosed = isClosed;
    this.isConnecting = isConnecting;
    this.isActive = isActive;
    this.isReconnecting = isReconnecting;


    //=========================================================================
    // 信道状态处理，状态说明：
    //   closed       - 已关闭
    //   connecting   - 首次连接
    //   active       - 当前信道已经在工作
    //   reconnecting - 断线重连中
    //=========================================================================
    function isClosed() { return me.status === STATUS_CLOSED; }
    function isConnecting() { return me.status === STATUS_CONNECTING; }
    function isActive() { return me.status === STATUS_ACTIVE; }
    function isReconnecting() { return me.status === STATUS_RECONNECTING; }

    function setStatus(status) {
        var lastStatus = me.status;
        if (lastStatus !== status) {
            me.status = status;
        }
    }

    // 初始为关闭状态
    setStatus(STATUS_CLOSED);


    //=========================================================================
    // 信道事件处理机制
    // 信道事件包括：
    //   connect      - 连接已建立
    //   close        - 连接被关闭（包括主动关闭和被动关闭）
    //   reconnecting - 开始重连
    //   reconnect    - 重连成功
    //   error        - 发生错误，其中包括连接失败、重连失败、解包失败等等
    //   [message]    - 信道服务器发送过来的其它事件类型，如果事件类型和上面内置的事件类型冲突，将在事件类型前面添加前缀 `@`
    //=========================================================================
    var eventHandlers = [];

    /**
     * 注册消息处理函数
     * @param {string} messageType 支持内置消息类型（"connect"|"close"|"reconnecting"|"reconnect"|"error"）以及业务消息类型
     */
    function registerEventHandler(eventType, eventHandler) {
        if (typeof eventHandler === 'function') {
            eventHandlers.push([eventType, eventHandler]);
        }
    }

    /**
     * 派发事件，通知所有处理函数进行处理
     */
    function dispatchEvent(eventType, eventPayload) {
        eventHandlers.forEach(function (handler) {
            var handleType = handler[0];
            var handleFn = handler[1];

            if (handleType === '*') {
                handleFn(eventType, eventPayload);
            } else if (handleType === eventType) {
                handleFn(eventPayload);
            }
        });
    }

    //=========================================================================
    // 信道连接控制
    //=========================================================================
    var isFirstConnection = true;

    /**
     * 连接信道服务器，获取 WebSocket 连接地址，获取地址成功后，开始进行 WebSocket 连接
     */
    function openConnect() {
        console.log('开始准备连接')

        // 只有关闭状态才会重新进入准备中
        setStatus(isFirstConnection ? STATUS_CONNECTING : STATUS_RECONNECTING);

        openSocket(me.socketUrl);
    }

    /**
     * 打开 WebSocket 连接，打开后，注册微信的 Socket 处理方法
     */
    function openSocket(url) {
        wxTunnel.listen({
            onOpen: handleSocketOpen,
            onMessage: handleSocketMessage,
            onClose: handleSocketClose,
            onError: handleSocketError,
        });
        console.log('现在开始connctSocket')
        wx.connectSocket({ 
            url: encodeURI(url),
            success(res){
                console.log('wx.connectSocket调用成功', res)
            },
            fail(res){
                console.log('wx.connectSocket调用失败', res)
            }
        });
        isFirstConnection = false;
    }


    //=========================================================================
    // 处理消息通讯
    //
    // packet           - 数据包，序列化形式为 `${type}` 或者 `${type}:${content}`
    // packet.type      - 包类型，包括 message, ping, pong, close
    // packet.content?  - 当包类型为 message 的时候，会附带 message 数据
    //
    // message          - 消息体，会使用 JSON 序列化后作为 packet.content
    // message.type     - 消息类型，表示业务消息类型
    // message.content? - 消息实体，可以为任意类型，表示消息的附带数据，也可以为空
    //
    // 数据包示例：
    //  - 'ping' 表示 Ping 数据包
    //  - 'message:{"type":"speak","content":"hello"}' 表示一个打招呼的数据包
    //=========================================================================

    // 连接还没成功建立的时候，需要发送的包会先存放到队列里
    var queuedPackets = [];

    /**
     * WebSocket 打开之后，更新状态，同时发送所有遗留的数据包
     */
    function handleSocketOpen() {
        console.log('现在连接socket open')
        /* istanbul ignore else */
        if (isConnecting()) {
            // 派发事件connect
            dispatchEvent('connect');

        }
        else if (isReconnecting()) {
            dispatchEvent('reconnect');
            resetReconnectionContext();
        }

        setStatus(STATUS_ACTIVE);
        emitQueuedPackets();
        nextPing();
    }

    /**
     * onMessage消息包
     * 收到 WebSocket 数据包，交给处理函数
     */
    function handleSocketMessage(message) {
        dispatchEvent('message', message.data)

        // isReLogin用于重连
        var res = typeof(message.data) == 'string' ? JSON.parse(message.data) : message.data;
        var cmd = res['cmd']
        var errno = res['errno']
        if (cmd == 'onConnectStatus' && errno == 100) {
            isReLogin = true;
        }
        if (cmd == 'onTiModerator') {
            isModeratorOnTi = true;
        }
        if (cmd == 'onTi') {
            isModeratorOnTi = true; //被主播踢出
        }
    }

    /**
     * 发送数据包，如果信道没有激活，将先存放队列
     */
    function emitPacket(packet) {
        if (isActive()) {
            sendPacket(packet);
        } else {
            queuedPackets.push(packet);
        }
    }

    /**
     * 数据包推送到信道
     */
    function sendPacket(packet) {
        wx.sendSocketMessage({
            data: JSON.stringify(packet),
            fail: handleSocketError,
        });
    }

    function emitQueuedPackets() {
        queuedPackets.forEach(emitPacket);

        // empty queued packets
        queuedPackets.length = 0;
    }

    /**
     * 发送消息包
     */
    function emitMessagePacket(messageType, messageContent) {
        var packet = {
            cmd: messageType,
            data: messageContent,
        };

        emitPacket(packet);
    }


    //=========================================================================
    // 心跳、断开与重连处理
    //=========================================================================

    /**
     * 我们的逻辑：
     * 1. socket open之后每120s发一次ping
     * 2. socket close时，进行重连, 重连后每10s检测一次重连后的状态，直到检测到连接成功切检测次数不超限；重连成功，设置连接状态为成功
     * 
     * qcloud逻辑：
     * Ping-Pong 心跳检测超时控制，这个值有两个作用：
     *   1. 表示收到服务器的 Pong 相应之后，过多久再发下一次 Ping
     *   2. 如果 Ping 发送之后，超过这个时间还没收到 Pong，断开与服务器的连接
     * 该值将在与信道服务器建立连接后被更新
     */
    let pingTime = 120000;
    let pingPongTimeout = 10000;
    let pingTimer = 0;

    /**
     * 发送下一个 Ping 包
     */
    function nextPing() {
        clearInterval(pingTimer);
        pingTimer = setInterval(function(){
            emitMessagePacket('ping', {})
        }, pingTime);
    }
    
    // 已经重连失败的次数
    var reconnectTryTimes = 0;
    // 最多允许失败次数
    var maxReconnectTryTimes = DEFAULT_MAX_RECONNECT_TRY_TIMES;
    // 重连前等待时间增量
    var reconnectTimeIncrease = DEFAULT_RECONNECT_TIME_INCREASE;
    // 重连前等待的时间
    var waitBeforeReconnect = 0;
    var reconnectTimer = 0;
    // 每10s检测一次重连后的连接状态
    var imTimer = 0;

    //重连
    function reConnectSocket(){
        if(isReLogin) return

        if(reconnectTryTimes >= maxReconnectTryTimes){
            close();
            dispatchEvent('error', {
                code: ERR_RECONNECT,
                message: '消息服务重连次数超限'
            });
            return;
        }else{
            // 设置重连状态
            closeSocket()
            waitBeforeReconnect += reconnectTimeIncrease;
            setStatus(STATUS_RECONNECTING);
            reconnectTimer = setTimeout(doReconnect, waitBeforeReconnect);
        }

        if (reconnectTryTimes === 0) {
            dispatchEvent('reconnecting');
        }
        reconnectTryTimes += 1;

        // 重连后每10s检测一次链接状态，直到检测到链接成功
        clearTimeout(imTimer)
        imTimer = setTimeout(function(){
            if(isReconnecting()){
                reConnectSocket()
            }
        }, pingPongTimeout)
    }

    function doReconnect() {
        openConnect();
    }
    
    function resetReconnectionContext() {
        reconnectTryTimes = 0;
        waitBeforeReconnect = 0;
    }

    var isClosing = false;

    /**
     * 收到 WebSocket 断开的消息，处理断开逻辑
     */
    function handleSocketClose() {
        /* istanbul ignore if */
        if (isClosing) return;
        // 意外断开的情况，进行重连
        if(!isModeratorOnTi && isActive()){
            reConnectSocket()
        }
    }

    function close() {
        isClosing = true;
        closeSocket();
        setStatus(STATUS_CLOSED);
        resetReconnectionContext();
        isFirstConnection = false;
        clearTimeout(pingTimer);
        clearTimeout(reconnectTimer);
        dispatchEvent('close');
        isClosing = false;
    }

    function closeSocket() {
        wx.closeSocket();
    }


    //=========================================================================
    // 错误处理
    //=========================================================================

    /**
     * 错误处理
     */
    function handleSocketError(detail) {
        dispatchEvent('error', detail)
        
        switch (me.status) {
        case Tunnel.STATUS_CONNECTING:
            dispatchEvent('error', {
                code: ERR_SOCKET_ERROR,
                message: '连接信道失败，网络错误或者信道服务不可用',
                detail: detail,
            });
            break;
        }
    }

}

module.exports = Tunnel;