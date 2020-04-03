var app = getApp()
var util = require('../../utils/util.js')
var config = require('../../config.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'

var store = {}

Page({
    data: {
        toCommentAvatar: '',
        toUid: -1,
        danmuAniData: [],
        danmuArr: [],
        hideInputHint: false,
        inputVal: '',
        hideLogin: true,
        // 是否是我的匿名说
        isMyComment: true,
        // 输入框提示话题
        inputTips: [], 
        // 留言信息数组
        currentMsgGroup: []
    },
    onShow: function(){
        console.log('onshow')
        
        wx.setNavigationBarTitle({
            title: '最美真心话'
        })
        // 判断是否是首次启动
        if(store.isFirstLaunch){
            store.isFirstLaunch = false
            return
        }
        // 当不是首次启动，从后台切过来时
        if(!store.isFirstLaunch){
            console.log('从后台切')
            

            // 初始化弹幕
            this.getDanmuInfo(this.data.toUid)
        }

    },
    onHide(){
        console.log('onhide')
        this.clear()
    },
    onUnload(){
        console.log('onUnload')
        this.clear()
    },
    clear(){
        console.log('store.loopTimeArr:', store.loopTimeArr)
        store.loopTimeArr.forEach(val => {
            clearTimeout(val)
            console.log('清除定时器：', val)
        })
        store.loopTimeArr =  []
        store.insertedDanmuIndex = 0
        store.danmuArrCache = []

        this.setData({
            danmuArr: [],
            danmuAniData: []
        })
    },
    async onLoad(query){
        store = {
            isFirstLaunch: true,
            danmuArrCache: [],
            danmuId: 0,
            danmuEndIndex: -1, // 初始化动画已结束的index值
            insertedDanmuIndex: 0, // 已插入的弹幕条数
            loopTimeArr: [], // 循环插入弹幕的定时器
            danmuAreaHeight: 0, //单位px
            msgGroup: [], // 留言数组
            currentMsgIndex: 0, // 当前显示留言数组的批次
            sendMsgFlag: false 
        }
        util.debug('Load:', query)

        // 获取小程序配置信息
        this.getConfig()

        // 同步获取登录状态和用户信息
        try{
            await app.checkLogin()
            // 已登录
            this.loginSuccessCb(query)
        }catch(e){
            let toUid = query.toUserId == undefined ? -1 : query.toUserId
            // 未登录
            this.setData({
                hideLogin: false,
                toUid
            })
        }

    },
    getConfig(){
        let that = this
        qcloud.request({
            url: '/game/anonymity/config',
            success(res) {
                util.debug('config:', res.data)
                let data = res.data
                if(data.errno == 0){
                    store.msgGroup = data.data.messageGroups
                    
                    that.setData({
                        inputTips: data.data.inputTips,
                        currentMsgGroup: store.msgGroup[store.currentMsgIndex]
                    })                    
                }else{
                    util.showToast(data.msg, 5000)
                }
            }
        })
    },
    loginSuccessCb(query){
        console.log('login success:', query)
        // 判断是否是我自己的
        let isMyComment = query.toUserId == undefined || query.toUserId == app.globalData.userInfo.uid
        let toUid = query.toUserId == undefined ? app.globalData.userInfo.uid : query.toUserId
        
        this.setData({
            isMyComment,
            toUid
        })

        // 被邀请打开小程序，上报邀请人作为他完成的邀请任务
        if(!isMyComment){
            app.doTask({
                type: 3,
                doTaskUid: query.toUserId,
                success(){
                    util.debug(`uid:${query.toUserId} 完成了一个邀请任务`)
                }
            })
        }

        // 已登录
        wx.createSelectorQuery().select('.danmu').fields({
            size: true
        }, function(res){
            store.danmuAreaHeight = res.height
            // 初始化弹幕
            //thset()
            this.getDanmuInfo(this.data.toUid)
        }.bind(this)).exec()
    },
    initDanmuData(){

        var newDanmuArr = [
            {
                message: '1阿斯达撒'
            },
            {
                message: '1社会为反对'
            }
        ]
        this.insertDanmu(newDanmuArr)

        setTimeout(function(){
            var arr = [
                {
                    headPic: '../../static/index/1.jpg',
                    message: '2阿斯达撒'
                }
            ]
            this.insertDanmu(arr)
        }.bind(this), 3000)
    },
    /**
     * @description 获取弹幕信息以及留言对象的头像
     * @author smy
     * @date 2018-11-09
     * @param {*} uid 留言对象的userid
     */
    getDanmuInfo(uid){
        let that = this
        let danmuLen = store.danmuArrCache.length
        let limit = 20

        qcloud.request({
            url: '/game/anonymity/message',
            data: {
                toUserId: uid,
                offset: danmuLen,
                limit
            },
            success(res) {
                util.debug('danmuMsg:', res.data)
                let data = res.data
                if(data.errno == 0){
                    that.insertDanmu(data.data.list)
                    that.setData({
                        toCommentAvatar: data.data.toUserInfo['avatarUrl']
                    })

                    setTimeout(function(){
                        if(data.data.list.length == limit){
                            // 弹幕数据可能未拉完，继续拉下一页
                            that.getDanmuInfo(uid)
                        }
                    }, 500)
                }else{
                    util.showModal('获取弹幕信息失败', data.msg)
                }
            }
        })
    },
    insertDanmu(newDanmuArr){
        let that = this

        // 初始化弹幕数组
        newDanmuArr.forEach((val) => {
            val['top'] = that.getDanmuRandomTop()
            val['moving'] = true
            val['headPic'] = '../../static/comment/avatar.png'
            val['danmuId'] = store.danmuId
            store.danmuId++
            
            store.danmuArrCache.push(val)
        })
        console.log('store.loopTimeArr.len', store.loopTimeArr)
        if(store.loopTimeArr.length == 0){
            this.loopRunDanmu()
        }
    },
    getDanmuRandomTop(){
        var rand_top = 0;
        (function loop(){
            let len = store.danmuArrCache.length
            
            // 单条弹幕的高度按照50px进行估算
            rand_top = parseInt(Math.random()*(store.danmuAreaHeight - 50))
            if(len === 0) return rand_top
            
            // 对每条弹幕的前面4条弹幕取高度进行判断
            for(var i = 1; i < 4; i++){
                //console.log(`倒数第${i}条检测完毕`)
                if(!store.danmuArrCache[len - i] || !store.danmuArrCache[len-i]['moving']) break

                let abs_num = Math.abs(store.danmuArrCache[len - i]['top'] - rand_top)
                if( abs_num < 50){
                    loop()
                    break
                }
            }

        })()
        return rand_top
    },
    loopRunDanmu(){
        let that = this
        let total_len = store.danmuArrCache.length
        let index = store.insertedDanmuIndex

        if(total_len == 0) return

        if(index >= total_len){
            // 循环结束，继续轮询
            //store.insertedDanmuIndex = 0
            // 开启循环检测是否有新弹幕生成，有的话再次setDanmuData
            setTimeout(function(){
                this.loopRunDanmu()
            }.bind(this), 200)
            //console.log('开始下一轮循环')
            return
        }

        this.setDanmuData(index, function(){
            store.insertedDanmuIndex++
            that.loopRunDanmu()
        })
    },
    
    setDanmuData(index, runDanmuCb){
        let that = this
        // 设置随机插入的间隔时间，200-1300ms
        let time = Math.random()*1300 + 200
        let loop_time = setTimeout(()=>{
        
            // 防止页面切换时定时器没清理干净导致上一页面index带到下一页面
            if(store.danmuArrCache[index] == undefined) return

            // 插入数据到视图
            that.setData({
                [`danmuArr[${index}]`]: store.danmuArrCache[index]
            }, function(){
                // 渲染完毕，开始执行动画
                that.runDanmu(index)
                
                // 插入并运行此条弹幕动画后的回调
                runDanmuCb && runDanmuCb()
            })
        }, time)
        store.loopTimeArr.push(loop_time)
    },
    
    runDanmu(index){
    
        let animation = wx.createAnimation({
            duration: 7000
        })

        animation.right('750rpx').translateX(0).step()
        this.setData({
            [`danmuAniData[${index}]`]: animation.export()
        })
    },
    /**
     * @description 弹幕动画结束的回调
     * @author smy
     * @date 2018-11-19
     * @param {*} e 弹幕参数
     */
    aniend(e){
        let i = e.currentTarget.dataset.index

        // 防止弹幕动画多次执行回调，导致函数体多次执行
        if(store.danmuEndIndex != i){
            store.danmuEndIndex = i
            store.danmuArrCache[i]['moving'] = false

            // 恢复动画到最初状态
            let animation = wx.createAnimation({
                duration: 0
            })
            animation.right('0').translateX('100%').step()
            this.setData({
                [`danmuAniData[${i}]`]: animation.export()
            })

            // 继续循环运行此条弹幕
            this.setDanmuData(i)
        }else{
            store.danmuEndIndex = -1
        }
        /* else if(store.danmuEndIndex == len-1){
            // 每次和弹幕缓存的数量进行对比判断，当是最后一条数据的时候
            store.danmuEndIndex = -1
        } */
    },
    /*input输入*/
    onInputFocus(){
        this.setData({
            hideInputHint: true
        })
    },

    onInputBlur(){
        if(this.data.inputVal == ''){
            this.setData({
                hideInputHint: false
            })
        }
    },

    onInputChange(e) {
        this.setData({
            inputVal: e.detail.value,
            hideInputHint: e.detail.value !== ''
        })

    },
    async sendMsg(){
        if(store.sendMsgFlag) return
        store.sendMsgFlag = true

        let val = this.data.inputVal
        if(val == ''){
            util.showToast('请先填写留言信息')
            store.sendMsgFlag = false
            return
        }
        if(val.length > 50){
            util.showToast('留言字数不能超过50字')
            store.sendMsgFlag = false
            return
        }

        var newDanmuArr = [
            {
                message: val
            }
        ]
        try{
            util.showToast('发送中...')
            await this.submitMsg()
            
            store.sendMsgFlag = false
            this.insertDanmu(newDanmuArr)
            wx.hideToast()
        }catch(e){
            store.sendMsgFlag = false
        }
    },
    submitMsg(){
        let that = this
        return new Promise((resolve, reject) => {
            qcloud.request({
                url: '/game/anonymity/sendMessage',
                data: {
                    toUserId: that.data.toUid,
                    message: that.data.inputVal
                },
                method: 'POST',
                success(res) {
                    let data = res.data
                    if(data.errno == 0){
                        // 弹幕提交成功
                        that.setData({
                            inputVal: '',
                            hideInputHint: false
                        })
    
                        // 提交给他人留言任务
                        if(that.data.toUid != app.globalData.userInfo.uid){
                            app.doTask({
                                type: 2,
                                doTaskUid: app.globalData.userInfo.uid,
                                success(){
                                    util.debug(`uid:${app.globalData.userInfo.uid} 完成了一个给他人留言任务`)
                                }
                            })
                        }
                        resolve(true)
                    }else{
                        util.showModal('提交弹幕信息失败', data.msg)
                        reject()
                    }
                }
            })

        })
    },
    /* 留言文案选择区 */
    checkWords(e){
        this.setData({
            inputVal: e.target.dataset.msg
        })
        this.onInputFocus()
    },
    /*换一批 */
    changeWords(){
        /* for(let i = 0; i< 15; i++){
            this.testMsg()
        }
        return 
 */
        let len = store.msgGroup.length
        store.currentMsgIndex++
        store.currentMsgIndex = store.currentMsgIndex < len ? store.currentMsgIndex : 0
        
        this.setData({
            currentMsgGroup: store.msgGroup[store.currentMsgIndex]
        })
    },
    testMsg(){
        this.setData({
            inputVal:  `测试消息${Math.random()}`
        })
        this.sendMsg()
    },
    /*授权登录 */
    getAuthLogin(res) {
        console.log('bindgetuserinfo:', res)
        let errmsg = res.detail.errMsg
        let that = this
        if( errmsg=== 'getUserInfo:fail auth deny'){
                //取消授权
                //failCb()
        }else if(errmsg === 'getUserInfo:ok'){
            app.goLogin(() => {
                // 登录成功回调
                that.setData({
                    hideLogin: true
                })
                // 登录成功初始化弹幕等信息
                let params = that.data.toUid == -1 ? {} : {toUserId: that.data.toUid}
                that.loginSuccessCb(params)
            })
        }else{
            wx.showToast({
                title: errmsg,
                duration: 10000,
                icon: 'none'
            })
        }
        
    },
    /**创建我的匿名说 */
    goToMyPage(){
        wx.reLaunch({
            url: '/pages/index/index'
        })
    },
    /*分享*/
    goShare(e){
        let type = e.currentTarget.dataset.type
        let text = type == 1 ? '快让好友来倾诉' : '在对方留言页分享'
        // 统计
        app.aldstat.sendEvent('点击分享', {
            'button': text
        })
        wx.navigateTo({
            url: `/pages/poster/poster?uid=${this.data.toUid}`
        })
    },
    checkNetwork(){
        wx.getNetworkType({
            success(res){
                util.debug('res.networkType :', res.networkType )
                if(res.networkType == 'none'){
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }
            }
        })
    },
    onShareAppMessage(e){
        return {
            title: '快来偷偷说出你的真心话吧！',
            path: `/pages/index/index?toUserId=${app.globalData.userInfo.uid}`,
            imageUrl: '/static/common/share.png',
            success(res){
                if(res.errMsg == 'shareAppMessage:ok'){
                    // 分享成功
                    console.log('分享成功')
                }
            },
            fail(res){
                console.log('fail:', res)
                if(res.errMsg == 'shareAppMessage:cancel'){
                    // 取消分享
                    console.log('取消分享')
                }
            }
        }
    }
});