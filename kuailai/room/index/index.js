var app = getApp()
var util = require('../../utils/util.js')
var config = require('../../config.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
// polyfill: async/await
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'

/*全局定义身份标志和消息类型*/
const ROOM_COMMON_USER = "1";
const ROOM_MODERATOR_USER = "2";
const ROOM_ADMIN_USER = "3";
const ROOM_DEAD_USER = "4";
const ROOM_OWN_USER = "5";
const ROOM_OFFICIAL = "6";
const ROOM_OFFICIAL_ADMIN = "7";

const ROOM_TIP_MSG = "1";
const ROOM_TALK_MSG = "2";
const ROOM_USER_IN_MSG = "3";
const ROOM_TIP_GIFT_MSG = "4";
const ROOM_SEND_GIFT_MSG = "5";
const ROOM_SEND_FLOWER_MSG = "6";
const ROOM_LEVEL_INCREASE_MSG = "7";
const ROOM_SYSTEM_MSG = "8";
const ROOM_INTERVAL_SYSTEM_MSG = "9";
const ROOM_SET_ADMIN_MSG = "10";
const ROOM_UNSET_ADMIN_MSG = "11";

/* 
* 状态管理未绑定在wxml中的变量，减少setData导致的不必要渲染性能消耗
！！！全局状态，在退出直播间，没有退出小程序的情况下，再次进入直播间，数据不会重新初始化
*/
var insertTime = 0;
var store = {}
function initStore() {
  store = {
    roomStatus: 'open', // 直播间状态
    stayTimeStart: 0, // 记录用户在直播间停留时长
    sendGiftId: -1, // 要赠送的礼物id
    PUSH_MSG_GAP_TIME: 1, // 间隔多少秒，setData一次聊天消息，防止消息过多频繁调用setdata进行渲染引起性能较大损耗
    MAX_CHAT_MSG_NUM: 10, // 最多允许插入的消息条数
    cacheMsgArr: [], // 用来临时记录，缓存需要setData的数据
    msgId: 0, // 记录消息的id，每条消息都给一个id，依次递增，用于wx:key
    isCheckIngCacheMsg: false,  // 是否正在循环检查缓存消息
    boxMsg: [], //记录宝箱口令，用户消息插入时的合并
    boxMsgCache: [], //记录宝箱口令消息缓存池
    BOX_MSG_CHECK_TIME: 10, // 每个多少s插入一次口令缓存的消息，默认10s
    BOX_MSG_CHECK_TIME_FIRST: 2, // 每个多少s插入一次口令缓存的消息，第一次的间隔时间，默认2s
    isCheckingBoxCache: false, // 是否正在循环检查口令红包的缓存池
    onlineNum: 0 // 记录房间在线人数，跟随消息更新频率更新
  }
}

Page({
  data: {
    statusBarH: app.globalData.statusBarHeight + 6,
    /*主播信息卡*/
    hideMInfoCard: true,
    hideMCardContent: true,
    mode: 1, // 是否是审核模式
    /*主播信息*/
    mid: '',
    mHeadPic: '',
    mInfo: {
      isPlaying: true
    },
    /*用户信息*/
    uInfo: {},
    isLogin: false,
    /*视频相关*/
    videoUrl: '',
    hidePosterMask: false, // 视频加载出来（2004）之前
    hideVideoMask: true, //视频拉取第一帧（2003）之前
    videoUpSlideDistance: 0, // 视频区域向上顶（移动）的距离
    /*是否显示底部功能区：发言，下载，礼物，分享*/
    hideFooterFuncArea: true,
    /*输入框*/
    // 已废弃：原生输入框在非聚焦情况不能覆盖在live-player上，所以当input blur时，显示临时模拟的输入框, 点击临时模拟输入框时，自动聚焦原生输入框
    // 解决方案: 把视频顶上去，input用非原生组件
    inputFocus: false, //输入框是否聚焦
    hideChatInputArea: true,
    inputVal: '', // 聊天输入框的内容

    /*礼物栏*/
    giftsSwiperArr: [],
    hideGiftsArea: true,
    hideGiftNumBox: true,
    hideFacesArea: true,
    giftSelecteditem: -1, // 礼物选中的页码
    giftSelectedIndex: -1, // 礼物选中的index
    previewGiftUrl: '', //礼物栏选择预览的图片地址
    sendGiftNum: '1', //要赠送的礼物数量
    isHideGiftsPlaceholder: true,
    /*礼物数量*/
    giftsNumType: [
      { num: 1, content: '一心一意' },
      { num: 10, content: '十全十美' },
      { num: 30, content: '想你' },
      { num: 66, content: '一切顺利' },
      { num: 188, content: '要抱抱' },
      { num: 520, content: '我爱你' },
      { num: 1314, content: '一生一世' }
    ],
    /*表情*/
    faces: [],
    /*聊天消息*/
    chatMsg: [],
    flag: {
      'COMMON_USER': ROOM_COMMON_USER,
      'MODERATOR_USER': ROOM_MODERATOR_USER,
      'ADMIN_USER': ROOM_ADMIN_USER,
      'DEAD_USER': ROOM_DEAD_USER,
      'OWN_USER': ROOM_OWN_USER,
      'OFFICIAL': ROOM_OFFICIAL,
      'OFFICIAL_ADMIN': ROOM_OFFICIAL_ADMIN,
      'TIP_MSG': ROOM_TIP_MSG,
      'TALK_MSG': ROOM_TALK_MSG,
      'USER_IN_MSG': ROOM_USER_IN_MSG,
      'TIP_GIFT_MSG': ROOM_TIP_GIFT_MSG,
      'SEND_GIFT_MSG': ROOM_SEND_GIFT_MSG,
      'SEND_FLOWER_MSG': ROOM_SEND_FLOWER_MSG,
      'LEVEL_INCREASE_MSG': ROOM_LEVEL_INCREASE_MSG,
      'SYSTEM_MSG': ROOM_SYSTEM_MSG,
      'INTERVAL_SYSTEM_MSG': ROOM_INTERVAL_SYSTEM_MSG,
      'SET_ADMIN_MSG': ROOM_SET_ADMIN_MSG,
      'UNSET_ADMIN_MSG': ROOM_UNSET_ADMIN_MSG
    },
    scrolltop: 999,
    /*登录弹框显隐*/
    hideLoginLayer: true,
    /*是否显示关注提示弹框*/
    isHideFollowHintLayer: true,
    /*休息中推荐列表*/
    restRecommendItems: [],
    showGiftsAndHideFunc: false,
    platform: 'android',
    /*飘屏通知 */
    informAnimation: [],
    informData: [],
    postBgWidth: 450,
    /*pk时video的高度 */
    pkVideoHeight: '100%',
    pkVideoBottom: 0,
    hidePKBg: true,
    isHideRestArea: false,
    isShowMiniVideo: true,
    // 进房间10s强提示登录
    strongHintLoginLayer: true,
    // 下载按钮显示
    hideDownBtn: true,
  },
  async onLoad(query) {
    // 获取推广渠道id是否存在
    if (query.channel) {
      config.headerInfo.channel = query.channel
    }

    initStore()

    let globaldata = app.globalData

    // 获取poster宽度
    let poster_w = this.getPosterWidth()

    // 初始化直播间参数
    util.debug('roomQuery:', query)
    //query.videourl = 'rtmp://9180.liveplay.myqcloud.com/live/9180_1013223'
    this.setData({
      mid: query.mid,
      mHeadPic: query.headPic,
      videoUrl: query.videourl,
      uInfo: globaldata.userInfo,
      isLogin: globaldata.isLogin,
      platform: globaldata.platform,
      postBgWidth: poster_w,
      mode: app.globalData.mode
    })
    store.stayTimeStart = +new Date()



    // 获取主播信息
    await this.initMInfo()
    let mInfo = this.data.mInfo
    if (!mInfo.isPlaying) {
      this.showRestPage()
    } else {
      util.showBusy('正在加载...')
      this.setData({
        videoUrl: mInfo.videoPlayUrl
      })
    }

    // 更新store中的onlinenum
    store.onlineNum = this.data.mInfo.onlineNum

    // pk时，充值video高度
    if (mInfo.isPK) {
      this.showPkVideo()
    }

    // 初始化IMsocket
    this.initIMSocket()

  },
  onShow() {
    // 用于跳转充值页充值成功后，更新用户余额
    if (this.data.isLogin) {
      this.setData({
        'uInfo.coin': app.globalData.userInfo.coin
      })
    } else {
      setTimeout(() => {
        if (!this.data.isLogin) {
          this.setData({
            strongHintLoginLayer: false
          })
        }
      }, 10000)
    }
  },
  onReady() {
    this.videoCtx = wx.createLivePlayerContext('myPlayer')
    // 是否隐藏下载 0不隐藏 1隐藏
    if (app.globalData.mode === 1) {
      this.setData({
        hideDownBtn: true
      })
    } else {
      this.setData({
        hideDownBtn: false
      })
    }
  },
  getPosterWidth() {
    // 计算背景poster的宽度
    let screen_h = app.globalData.systemInfo.screenHeight
    return screen_h * 1.1
  },
  playVideo() {
    this.videoCtx.play()
  },
  stopVideo() {
    this.videoCtx && this.videoCtx.stop({
      success(res) {
        console.log('视频停止:', res)
      }
    })
    wx.hideToast()
  },
  resumeVideo() {
    // 恢复推流
    this.videoCtx.resume()
  },
  onVideoStatechange(e) {
    /** 
     * 视频完全加载出来前四个阶段：
     * 1. page背景色：page加载，未渲染数据前
     * 2. 默认背景图：page开始渲染data数据
     * 3. 主播头像高斯模糊图：page onload后，数据渲染完，视频加载状态2004前
     * 4. 主播头像高清图：视频加载状态2004（视频开始播放，此时高斯模糊图片隐藏，live-player显示）之后，2003（加载到第一帧视频数据包）之前
    */
    let errmsg = config.videoStatus[String(e.detail.code)]
    //errmsg = errmsg === undefined ? '视频状态未知' : errmsg
    if (e.detail.code == -2301) {
      util.showModal('加载失败', errmsg)
    } else if (e.detail.code == 2105 || e.detail.code == 2009) {
      wx.showToast({
        title: errmsg,
        icon: 'loading',
        duration: 1500
      })
    } else if (e.detail.code != 6000 && errmsg !== undefined) {
      util.showBusy(errmsg)
    }

    if (e.detail.code === 2004) {
      // 视频播放开始 
    }
    if (e.detail.code === 2003) {
      let that = this

      // 网络接收到首个视频数据包(IDR)
      setTimeout(function () {
        wx.hideToast()
        that.setData({
          hideVideoMask: true,
          isShowMiniVideo: false
        })
      }, 200)
    }

    util.debug(`live-player code:${e.detail.code} ${e.detail.message}`)
  },
  onVideoError(e) {
    util.debug(`live-player error:${e.detail.errMsg}`)
    wx.showToast({
      title: e.detail.errMsg || 'video error',
      icon: 'none'
    })
  },
  // 重置pk时video的高度，不完全覆盖背景，使视觉上直播间有一个背景图
  showPkVideo() {
    util.debug('PK,开始重置video样式')

    let win_w = app.globalData.systemInfo.screenWidth
    let win_H = app.globalData.systemInfo.screenHeight
    //pk时视频比例3：4, 视频宽度css中设置为101%
    let video_h = win_w * 3 / 4 * 101 / 100 - 2
    let video_bottom = win_H / 2 - video_h / 2 + video_h / 4

    this.setData({
      pkVideoHeight: video_h + 'px',
      pkVideoBottom: video_bottom,
      hidePKBg: false,
      hideVideoMask: false
    })
  },
  resizePkVideo(data) {
    this.setData({
      pkVideoHeight: '100%',
      pkVideoBottom: 0,
      hidePKBg: true,
      videoUrl: data.playUrl,
      'mInfo.isPK': false,
      isShowMiniVideo: true,
      hideVideoMask: true
    })
  },
  initFaces() {
    var faceCode = ['1f603', '1f60d', '1f614', '1f633', '1f604', '1f612', '1f616', '1f61c', '263a', '1f601', '1f613', '1f60a', '1f630', '1f631', '1f61e', '1f621', '1f62d', '1f602', '1f618', '1f623', '1f61a', '1f61c', '1f609', '1f632', '1f625', '1f60c', '1f637', '1f47d', '2764', '1f494', '1f44f', '1f44a', '1f44c', '1f44d', '1f44e', '1f48b', '1f414', '1f40f', '1f43b', '1f437', '1f418', '1f412', '1f42f', '1f430', '1f433', '1f436', '1f446', '1f447', '1f449', '1f448', '1f48a', '1f35e', '1f353', '1f34c', '1f34e', '1f345', '1f349', '1f366', '1f361', '26a1', '2600', '1f319', '1f31a', '1f31d', '1f375', '1f37c', '1f335', '1f4a9', '1f4a8', '1f648'],
      faceText = ['[大笑]', '[色]', '[失望]', '[脸红]', '[开心]', '[嫌弃]', '[呸]', '[吐舌]', '[热情]', '[露齿笑]', '[汗]', '[笑脸]', '[担心]', '[恐惧]', '[低落]', '[生气]', '[哭]', '[破涕为笑]', '[飞吻]', '[悔恨]', '[亲吻]', '[鬼脸]', '[眨眼]', '[晕]', '[焦虑]', '[满意]', '[生病]', '[外星人]', '[心]', '[心碎]', '[喝彩]', '[拳头]', '[好的]', '[强]', '[弱]', '[红唇]', '[鸡]', '[羊]', '[熊]', '[猪]', '[象]', '[猴]', '[虎]', '[兔]', '[鲸鱼]', '[狗]', '[上]', '[下]', '[右]', '[左]', '[药丸]', '[面包]', '[草莓]', '[香蕉]', '[苹果]', '[西红柿]', '[西瓜]', '[冰激凌]', '[丸子]', '[闪电]', '[晴天]', '[月亮]', '[日全食]', '[太阳]', '[茶]', '[奶瓶]', '[仙人掌]', '[便便]', '[吹气]', '[非礼勿视]'];

    var faces = []
    for (var i = 0; i < 70; i++) {
      //faces.push({ img: `../../static/img/room/face/emoji_${faceCode[i]}.png`, data: faceText[i] });
      faces.push({ img: `https://static.guojiang.tv/pc/v3/img/face/emoji_${faceCode[i]}.png`, data: faceText[i] });
    }

    this.setData({ faces })
  },
  getFaceUrl(msg) {
    var faces = this.data.faces
    var len = faces.length
    var targetUrlArr = []
    for (var i = len - 1; i >= 0; i--) {
      let regexp = new RegExp("\\" + faces[i].data, 'g')
      if (regexp.test(msg)) {
        console.log('表情：', faces[i].data)
        targetUrlArr.push(faces[i].img)
      }
    };
    return targetUrlArr;
  },
  chooseFace(e) {
    let index = e.currentTarget.dataset.index
    let faceText = this.data.faces[index].data
    let inputVal = this.data.inputVal

    this.setData({
      inputVal: inputVal + faceText
    })
  },
  /*获取主播信息*/
  async initMInfo() {
    try {
      let getMInfo = await this.getMInfo()
      if (getMInfo.errno == 0) {
        this.setData({
          mInfo: getMInfo.data
        })
        return getMInfo
      } else {
        util.showToast(getMInfo.msg, 10000)
      }
    } catch (e) {
      util.showToast(e.message)
    }
  },
  getMInfo() {
    return new Promise((resolve, reject) => {
      let that = this
      if (that.data.mid === '') {
        reject('主播id丢失')
        return
      }

      qcloud.request({
        url: '/index/room',
        data: {
          mid: that.data.mid
        },
        success(res) {
          util.debug('mInfo:', res.data)

          let data = res.data
          resolve(data)
        }
      })
    })

  },
  /*关注主播*/
  goFollow(e) {
    if (!app.globalData.isLogin) {
      this.goLogin()
      return
    }

    let that = this
    let type = e ? e.currentTarget.dataset.type : 'layer'
    qcloud.request({
      url: '/index/attention',
      data: {
        mid: that.data.mid
      },
      success(res) {
        let data = res.data
        if (data.errno == 0) {
          util.showSuccess('关注成功')

          if (type == 'icbtn') {
            // 左上角胶囊按钮的关注
          } else if (type == 'layer') {
            // 离开直播间时的关注提示弹框
            that.hideFollowHintLayer()
          }

          // 隐藏左上角关注按钮
          that.setData({
            'mInfo.isAttention': true
          })
        } else {
          util.showToast(data.msg, 10000)
        }
      }
    })
  },
  doNotFollow() {
    this.hideFollowHintLayer()
    this.quitRoom()
  },
  /*显示主播信息卡*/
  async toggleModeratorCard() {
    let isHideMInfoCard = this.data.hideMInfoCard
    this.setData({
      hideMInfoCard: !isHideMInfoCard
    })

    if (isHideMInfoCard) {
      // 获取主播信息
      await this.initMInfo()
      this.setData({
        hideMCardContent: false
      })
    } else {
      this.setData({
        hideMCardContent: true
      })
    }
  },

  ontouchstart(e) {
    //console.log('touchstart:', e)
  },
  ontouchend(e) {
    //console.log('touchend:', e)
  },
  ontouchmove(e) {
    //console.log('touchmove:', e)
  },
  /*分享*/
  onShareAppMessage(res) {
    if (res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    let data = this.data
    return {
      title: this.data.mInfo.shareMsg,
      path: `/room/index/index?mid=${data.mid}&videourl=${data.videoUrl}&headPic=${data.mHeadPic}`,
      imageUrl: data.mHeadPic
    }
  },
  /*礼物栏*/
  toggleGiftsArea() {
    let that = this
    if (this.data.hideGiftsArea) {
      if (this.data.giftsSwiperArr.length == 0) {
        // 初始化礼物信息
        this.getGifts()
      }
      this.setData({
        showGiftsAndHideFunc: true,
        isHideRestArea: true
      })

      let that = this
      let pkVideoBottomTem = this.data.pkVideoBottom
      // 判断是否是PK状态, 将视频同等向上或向下移动100px
      if (this.data.mInfo.isPK) {
        //pk状态
        pkVideoBottomTem += 100
      }
      setTimeout(function () {
        that.setData({
          hideGiftsArea: !that.data.hideGiftsArea,
          videoUpSlideDistance: 616,
          pkVideoBottom: pkVideoBottomTem
        })
      }, 100)
    } else {
      let pkVideoBottomTem = this.data.pkVideoBottom
      // 判断是否是PK状态, 将视频同等向上或向下移动100px
      if (this.data.mInfo.isPK) {
        //pk状态
        pkVideoBottomTem -= 100
      }
      this.setData({
        hideGiftsArea: !this.data.hideGiftsArea
      }, function () {
        that.setData({
          isHideRestArea: false,
          videoUpSlideDistance: 0,
          showGiftsAndHideFunc: false,
          pkVideoBottom: pkVideoBottomTem
        })
      })
    }
  },
  toggleGiftNumBox() {
    if (store.sendGiftId == -1) {
      util.showToast('请选择要赠送的礼物', 1500)
      return
    }

    this.setData({
      hideGiftNumBox: !this.data.hideGiftNumBox
    })
  },
  selectGifts(e) {
    let itemindex = e.currentTarget.dataset.itemindex
    let index = e.currentTarget.dataset.index
    let pid = e.currentTarget.dataset.pid
    let img = e.currentTarget.dataset.img

    this.setData({
      giftSelectedItem: itemindex,
      giftSelectedIndex: index,
      previewGiftUrl: img//设置图片预览地址
    })
    store.sendGiftId = pid

    console.log('selected index：', this.data.giftSelectedIndex)
  },
  selectGiftNum(e) {
    let num = e.currentTarget.dataset.num
    this.setData({
      sendGiftNum: num
    })
    this.toggleGiftNumBox()
  },
  /*显示聊天输入layer*/
  showChatInputLayer() {
    this.setData({
      videoUpSlideDistance: 86,
      hideChatInputArea: false, // 显示input，表情等弹框
      inputFocus: true // input 聚焦
    })
  },
  /*关闭聊天输入layer*/
  hideChatInputLayer() {
    this.setData({
      videoUpSlideDistance: 0,
      hideChatInputArea: true, // 关闭
      inputFocus: false,  // 去掉 input 聚焦
      hideFacesArea: true //隐藏表情面板
    })
  },
  onInputBlur(e) {
  },
  /*点击键盘右下角发送按钮*/
  confirmChat(e) {
    this.sendMsg()
  },
  bindKeyInput: function (e) {
    this.setData({
      inputVal: e.detail.value
    })
  },
  /*点击表情icon: 显示表情图集*/
  showFacesArea() {
    //初始化表情
    if (this.data.faces.length == 0) {
      this.initFaces()
    }

    this.setData({
      videoUpSlideDistance: 436,
      hideFacesArea: false,
      inputFocus: false
    })
  },
  /**发送消息**/
  sendMsg() {
    if (!app.globalData.isLogin) {
      this.goLogin()
      return
    }

    // 发送消息
    this.tunnel.emit('sendMsg', { "msg": this.data.inputVal, "toUid": 0, "private": false });

    // 清空输入框
    this.setData({
      inputVal: ''
    })
  },
  /*赠送礼物*/
  sendGift() {
    if (!app.globalData.isLogin) {
      this.goLogin()
      return
    }

    if (store.sendGiftId == -1) {
      util.showToast('请选择要赠送的礼物', 1500)
      return
    }

    this.tunnel.emit('sendGift', { pid: store.sendGiftId, num: this.data.sendGiftNum })
  },

  /*关闭直播间*/
  closeRoom() {
    // 如果未关注主播， 且停留时间超过三分，显示关注提示
    let stayTime = this.getStayTime()
    if (!this.data.mInfo.isAttention && stayTime > 180) {
      this.showFollowHintLayer()
      return
    }

    store.roomStatus = 'closing'
    this.quitRoom()
  },
  /*物理离开直播间时*/
  onUnload() {
    console.log('离开了直播间roomStatus:', store.roomStatus)
    if (store.roomStatus === 'closing') return
    this.quitSocket()
  },
  /*立刻退出直播间*/
  quitRoom() {
    this.quitSocket()

    var pages = getCurrentPages()
    if (pages.length == 1 && pages[0].route == 'room/index/index') {
      util.debug('没有上一页，准备跳转到首页')
      wx.reLaunch({
        url: '/pages/index/index'
      })
      return
    }

    wx.navigateBack()
  },
  initBox(command) {
    var that = this
    var boxMsg = store.boxMsg
    // 暂存宝箱口令内容
    if (Array.isArray(command)) {
      command.forEach((val) => {
        insertBoxMsg(val)
      })
    } else {
      insertBoxMsg(command)
    }

    function insertBoxMsg(command) {
      console.log('!boxMsg.includes(command):', !boxMsg.includes(command))
      if (!boxMsg.includes(command)) {
        boxMsg.push(command)
      }
    }

    if (!store.isCheckingBoxCache) {
      // 标志正在检查口令缓存池
      store.isCheckingBoxCache = true

      setTimeout(function () {
        that.checkBoxMsgCache()
      }, store.BOX_MSG_CHECK_TIME_FIRST * 1000)

    }
  },
  /*socket处理*/
  checkBoxMsgCache() {
    let that = this
    let boxMsgCache = store.boxMsgCache

    util.debug('缓存口令数组：boxMsg:', store.boxMsg)
    util.debug('缓存口令数组：boxMsgCache:', store.boxMsgCache)

    if (boxMsgCache.length == 0) {
      console.log(`全部宝箱失效了:`, boxMsgCache.length)
      store.isCheckingBoxCache = false
      return
    }

    boxMsgCache.forEach((boxArr, index) => {

      // 合并宝箱口令缓存池消息到消息队列
      // 取第一个人的昵称，合并成: xxx等x人说：xxx
      let targetMsg = boxArr[0]
      let cacheLen = boxArr.length

      if (cacheLen == 0) {
        // 删除口令内容数组。
        // 不再塞消息到口令缓存池，等待下一个宝箱再次开启这个检测过程
        store.boxMsg.splice(index, 1)
        return
      } else if (cacheLen > 1) {
        targetMsg.msg.fromNickname += `等${cacheLen}人`
      }
      store.cacheMsgArr.push(targetMsg)
    });

    // 情况宝箱口令缓存池
    store.boxMsgCache = []

    // 一定时间后再次插入
    setTimeout(function () {
      that.checkBoxMsgCache()
    }, store.BOX_MSG_CHECK_TIME * 1000)
  },
  /**
   * 追加一条消息
   * chatMsg格式：
   * [
   *  {
   *    msg: {uid:'', nickname: '', type: ''...},
   *    msgType: 0
   *  },
   * {
   *    msg: {uid:'', nickname: '', type: ''...},
   *    msgType: 0
   *  }
   * ]
   */
  pushMsg(message, msgType) {
    this.updateMessages({ msg: message, msgType, insertType: 'push', msgId: store.msgId }, 'push')
  },
  /**
   * 替换上一条消息
   */
  amendMessage(message, msgType) {
    this.updateMessages({ msg: message, msgType, insertType: 'amend', msgId: store.msgId }, 'amend')
  },
  /**s
   * 通用更新当前消息集合的方法
   */
  updateMessages(msgObj, type) {
    // 增加消息唯一id，消息id递增，用于wx:key
    console.log('msgId:', store.msgId)
    store.msgId++

    // 对于宝箱口令消息，高峰每秒可达35条左右，对其进行合并显示
    if (store.boxMsg.includes(msgObj.msg.msg)) {
      let index = store.boxMsg.indexOf(msgObj.msg.msg)

      store.boxMsgCache[index] = store.boxMsgCache[index] == undefined ? [] : store.boxMsgCache[index]
      store.boxMsgCache[index].push(msgObj)
      util.debug('boxMsg:', store.boxMsg)
      util.debug('boxMsgCache:', store.boxMsgCache)
      return
    }

    // 对于短时间大量涌入的用户来了的消息，进行覆盖上一条
    let cacheData = store.cacheMsgArr
    let cacheLen = cacheData.length
    if (cacheLen >= 1
      && cacheData[cacheLen - 1].msgType == ROOM_USER_IN_MSG) {
      // 不处理
    } else if (type == 'amend') {
      store.cacheMsgArr.splice(-1, 1, msgObj)
    } else {
      // type: push, 直接新增消息
      store.cacheMsgArr.push(msgObj)
    }

    // 开启循环插入缓存消息
    if (!store.isCheckIngCacheMsg) {
      store.isCheckIngCacheMsg = true
      this.pushCacheMsg()
    }
  },
  /**
   * @description 将消息队列的缓存数据加入chatdata内，准备渲染到界面
   * @author smy
   * @date 2018-10-19
   */
  pushCacheMsg() {
    let that = this
    // 判断1s内缓存的条数，根据条数来动态更新要setData的消息条数
    let len = store.cacheMsgArr.length

    // 缓存消息为空，等待下一次循环
    if (len == 0) {
      if (store.isCheckingBoxCache) {
        // setData引起的界面更新渲染完毕后
        setTimeout(() => {
          that.pushCacheMsg()
        }, store.PUSH_MSG_GAP_TIME * 1000);
      }

      store.isCheckIngCacheMsg = false
      return
    }

    if (len <= 3) {
      store.MAX_CHAT_MSG_NUM = 10
    } else if (len > 3 && len <= 5) {
      store.MAX_CHAT_MSG_NUM = 8
    } else if (len > 5) {
      store.MAX_CHAT_MSG_NUM = 6
    }
    // 消息数过多，说明消息发的非常紧凑，每1s都满载数据，这时拉大数据插入间隔
    if (len > 25) {
      console.log('这么多消息，撑不住了')
      store.PUSH_MSG_GAP_TIME = 2
    } else {
      store.PUSH_MSG_GAP_TIME = 1
    }

    this.setChatMsgData(store.cacheMsgArr)
    // 清空消息缓存
    store.cacheMsgArr = []
  },
  /**
   * @description 将聊天消息压入page data进行渲染
   * @author smy
   * @date 2018-10-19
   * @param {*} msgArr： 要加入的新消息[array]
   */
  setChatMsgData(msgArr) {
    let that = this

    var new_msg_len = msgArr.length
    var old_msg_len = this.data.chatMsg.length
    var old_msg = this.data.chatMsg

    // 计算要setData的消息对象
    var newMsgArr = {}

    // 如果要插入的消息条数不超过最大的条数，且旧消息条数也不超过最大条数，那就挨个插入消息，否则，整体替换消息数组
    if (new_msg_len < store.MAX_CHAT_MSG_NUM && old_msg_len < store.MAX_CHAT_MSG_NUM) {
      console.log('逐一增加消息')
      msgArr.forEach((val, index) => {

        let insertIndex = old_msg_len
        // 仅对要插入的第一条数据进行判断
        // 非消息数组的第一条
        // 如果要插入的消息是amend类型或者上一条是 xx来了 的类型，则覆盖上一条消息
        if (index == 0
          && old_msg_len >= 1
          && (val.insertType == 'amend' || old_msg[old_msg_len - 1].msgType == ROOM_USER_IN_MSG)) {
          insertIndex = old_msg_len - 1
        } else {
          old_msg_len++
        }

        Object.assign(newMsgArr, {
          [`chatMsg[${insertIndex}]`]: val
        })
      })


    } else {
      console.log('整体替换消息')
      // ios设备不能滚动，遂直接保留聊天区有6条聊天数据即可
      let new_msg = old_msg.concat(msgArr)
      let insert_msg = new_msg.slice(parseInt(`-${store.MAX_CHAT_MSG_NUM}`))

      newMsgArr = { chatMsg: insert_msg }
    }

    // 插入数据到渲染层，并设置定时器1s后再次准备插入数据
    console.log('插入消息时间间隔：', Date.now() - insertTime)
    insertTime = Date.now()
    this.insertChatData(newMsgArr)
      .then(() => {
        // setData引起的界面更新渲染完毕后
        setTimeout(() => {
          that.pushCacheMsg()
        }, store.PUSH_MSG_GAP_TIME * 1000);

        // ios动态改变cover-view的scroll-top值，会导致cover-view滚动区域消失不见
        if (app.globalData.platform == 'android') {
          let data = that.data.scrolltop + 999
          that.setData({
            scrolltop: data
          })
        }
      })

  },
  insertChatData(msgObj) {
    let that = this
    return new Promise((resolve) => {
      // 增加在线人数的更新
      msgObj['mInfo.onlineNum'] = store.onlineNum

      that.setData(msgObj, resolve)
    })
  },
  /**
   * 退出聊天室
   */
  quitSocket() {
    let that = this
    return new Promise((resolve, reject) => {
      if (that.tunnel) {
        that.tunnel.close({
          success(res) {
            console.log('socket连接关闭调用成功', res)
            resolve(res)
          },
          complete(res) {
            reject(res)
          }
        });

      }

    })
  },

  async initIMSocket() {
    let that = this
    that.amendMessage('正在加入群聊...', ROOM_SYSTEM_MSG)
    util.debug('正在加入群聊...')

    // 如果已经连接socket, 先退出上一条
    console.log('检测是否有旧的socket连接：', this.tunnel)
    if (this.tunnel !== undefined) {
      this.quitSocket()
    }

    util.debug('开始新的socket连接')
    // 创建信道，需要给定后台服务地址
    //let socketUrl = this.data.mInfo.webSocketUrl
    let socketUrl = this.getSocketUrl()
    util.debug('获取socketurl：', socketUrl)

    var tunnel = this.tunnel = new qcloud.Tunnel(socketUrl);
    util.debug('信道对象：', tunnel)

    // 监听信道内置消息，包括 connect/close/reconnecting/reconnect/error
    tunnel.on('connect', () => {
      util.debug('WebSocket 信道已连接')
      that.amendMessage('聊天服务已连接', ROOM_SYSTEM_MSG)

      // socket准备就绪，显示底部功能区
      that.setData({ hideFooterFuncArea: false })

      // 初始化定时系统消息
      that.initIntervalSystemMsg()

      // 初始化宝箱消息
      let boxs = that.data.mInfo.boxList
      let newBoxArr = []
      if (boxs && boxs.length > 0) {
        boxs.forEach(function (val) {
          newBoxArr.push(val.command)
        })
        that.initBox(newBoxArr)
      }
    })
    tunnel.on('close', () => {
      util.debug('WebSocket 信道已断开')
      that.amendMessage('消息连接已断开...', ROOM_SYSTEM_MSG)
    });
    tunnel.on('reconnecting', () => {
      util.debug('WebSocket 信道正在重连...')
      that.pushMsg('正在重连消息...', ROOM_SYSTEM_MSG)
    });
    tunnel.on('reconnect', () => {
      util.debug('WebSocket 信道重连成功')
      that.pushMsg('消息连接成功', ROOM_SYSTEM_MSG)
    });
    tunnel.on('error', error => {
      util.debug('信道发生错误：', error)
      that.pushMsg('消息连接出错', ROOM_SYSTEM_MSG)
    });

    // 监听自定义消息（服务器进行推送）
    tunnel.on('message', msg => {
      let res = typeof (msg) == 'string' ? JSON.parse(msg) : msg;
      util.debug('收到 speak 消息：', res)

      var cmd = res['cmd'],
        data = res['data'],
        errno = res['errno'],
        msg = res['msg'];
      if (cmd == 'onConnectStatus') {
        that.onConnectStatus(errno, msg, data);
      }
      else if (cmd == 'onLogin') {
        that.onLogin(data);
      }
      else if (cmd == 'onLogout') {
        that.onLogout(data);
      }
      else if (cmd == 'onSendMsg') {
        that.onSendMsg(errno, msg, data);
      }
      else if (cmd == 'onSystemMsg') {
        that.onSystemMsg(errno, data.msg, data);
      }
      else if (cmd == 'onSendGift') {
        that.onGiftMsg(errno, msg, data);
      }
      else if (cmd == 'onBan') {
        that.onBan(errno, msg, data);
      }
      else if (cmd == 'onUnBan') {
        that.onUnBan(errno, msg, data);
      }
      else if (cmd == 'onSetAdmin') {
        that.onSetAdmin(errno, msg, data);
      }
      else if (cmd == 'onUnsetAdmin') {
        that.onUnsetAdmin(errno, msg, data);
      }
      else if (cmd == 'onTi') {
        that.onTi(errno, msg, data);
      }
      else if (cmd == 'onUserAttention') {
        that.onUserAttention(errno, msg, data);
      }
      else if (cmd == 'onVideoPublish') {
        that.onVideoPublishForAudience(errno, msg, data);
      }
      else if (cmd == 'onVideoUnpublish') {
        that.onVideoUnpublishForAudience(errno, msg, data);
      }
      else if (cmd == 'onTiModerator') {
        that.onTiModerator(errno, data.msg, data);
      }
      else if (cmd == 'onNewBulletBarrage') {
        // activity： 全站通知
        that.onNewBulletBarrage(errno, msg, data);
      }
      else if (cmd == 'onChangeVideoPullUrl') {
        //更换视频流
        that.onChangeVideoPullUrl(errno, msg, data);
      } else if (cmd == 'onPKStart') {
        //更换视频流
        that.onPKStart(errno, msg, data);
      } else if (cmd == 'onPKEnd') {
        //更换视频流
        that.onPKEnd(errno, msg, data)
      } else if (cmd == 'onNewBox') {
        //派发宝箱
        that.initBox(data[0].command)
      }
    });

    // 打开信道
    util.debug('正在建立信道连接...')

    tunnel.open();
  },
  onConnectStatus(errno, msg, data) {
    let uType = this.data.uInfo.type
    let that = this
    if (errno == 101) {
      if (uType == ROOM_MODERATOR_USER || uType == ROOM_OWN_USER) {
        util.showModal('', "主播你好，由于你违背了本平台管理公约，所以今日无法继续直播。请遵守《直播服务条例》的相关规定，避免今后出现违规直播的现象。")

      } else {
        // 停止视频流
        that.stopVideo()
        wx.showModal({
          content: "您已被管理员踢出房间，暂时无法进入",
          success(res) {
            that.quitRoom()
          }
        })
      }
    } else {
      that.pushMsg(msg, ROOM_TIP_MSG);
    }

    setTimeout(function () {
      that.stopVideo();
    }, 0)
  },
  /**
   * @description
   * @author smy
   * @date 2018-10-19
   * @param {*} errno
   * @param {*} msg
   * @param {*} data:
   * {
          operatorNickname:"Go1387707",
          operatorUid:"1387707",
          unsetAdminNickname :"522😉🤖",
          unsetAdminUid :"13895829"
      }
   */
  onSetAdmin(errno, msg, data) {
    if (errno == 0) {
      if (data.operatorUid == this.data.mInfo.mid) {
        data.operatorNickname = '主播'
      }

      if (data.setAdminUid == this.data.uInfo.uid) {
        data.setAdminNickname = '您已'
      }

      this.pushMsg(data, ROOM_SET_ADMIN_MSG)
    }
  },
  onUnsetAdmin(errno, msg, data) {
    if (errno == 0) {
      if (data.operatorUid == this.data.mInfo.mid) {
        data.operatorNickname = '主播'
      }
      if (data.unsetAdminUid == this.data.uInfo.uid) {
        data.unsetAdminNickname = '您已'
      }
      this.pushMsg(data, ROOM_UNSET_ADMIN_MSG)
    }
  },
  onLogin(data) {
    // 更新当前用户类型
    if (data.uid == this.data.uInfo.uid) {
      this.setData({
        'uInfo.type': data.type
      })
    }

    // 更新观看人数
    this.updateViewer(true)

    // 游客
    if (data.uid == -1) return

    this.pushMsg(data, ROOM_USER_IN_MSG)
  },
  onLogout() {
    // 更新观看人数
    this.updateViewer(false)
  },
  onSendMsg(errno, msg, data) {
    if (errno == -100) {
      // 未登录
      this.goLogin()
      return;
    }

    if (errno == 110) {
      // 发言送背包礼物相关，暂时屏蔽
      return;
    }

    if (errno != 0) {
      this.pushMsg(msg, ROOM_TIP_MSG);
      return;
    }
    // 小程序不支持渲染html标签，所以表情图片无法在正确的位置渲染，这里舍弃掉
    //data.msg = this.getFaceUrl(data.msg);
    this.pushMsg(data, ROOM_TALK_MSG);

  },
  /** 
   * 弹幕需要信息格式：
   * {
          headPic:'', //头像
          nickname: '', //昵称，标题
          level: '', // 等级
          msg: '', //通知信息
      }
  */
  onNewBulletBarrage(errno, msg, data) {
    // 付费弹幕
    if (errno == 0 && data.btype == 1) {
      this.showInformDanmu({
        nickname: util.filterHtml(data.nickname),
        headPic: data.headPic,
        level: data.level,
        msg: util.filterHtml(data.payload)
      })
    }
  },
  onSystemMsg(errno, msg, data) {
    // 弹窗限制 0不弹窗 1弹窗
    if (data.type == 0) {
      this.pushMsg(msg, ROOM_SYSTEM_MSG)
    } else {
      util.showToast(msg)
    }
  },
  onGiftMsg(errno, msg, data) {
    let that = this
    if (errno == -100) {
      this.goLogin()
      return;
    };
    if (errno == 101) {
      wx.showModal({
        content: '当前余额不足，充值后才能继续送礼，是否去充值',
        confirmText: '充值',
        confirmColor: '#ff0071',
        success(res) {
          console.log('res:', res)
          if (res.confirm) {
            // 充值
            that.goRechargePage()
          }
        }
      })
      return;
    }
    if (errno != 0) {
      this.pushMsg(msg, ROOM_TIP_GIFT_MSG);
      return;
    }

    if (errno == 0) {

      //显示送礼物信息
      this.pushMsg(data, ROOM_SEND_GIFT_MSG);

      // 星光值变动
      var uInfo = this.data.uInfo
      if (data.fromUid == uInfo.uid) {
        this.setData({
          'uInfo.coin': parseInt(uInfo.coin) - parseInt(data.cost)
        })

        util.showToast('赠送成功', 1500)
      }
    }

  },
  onBan(errno, msg, data) {
    let uid = this.data.uInfo.uid
    let banTime = this.data.mInfo.banTime

    if (!errno) {
      if (uid == data.banUid) {
        util.showToast('您已被管理员 ' + data.operatorNickname + ' 禁言' + banTime + '小时')
      } else {
        this.pushMsg(data.banNickname + ' 被管理员 ' + data.operatorNickname + ' 禁言' + banTime + '小时', ROOM_TIP_MSG);
      }
    } else {
      this.pushMsg(msg, ROOM_TIP_MSG);
    }
  },
  onUnBan(errno, msg, data) {
    let uid = this.data.uInfo.uid
    if (!errno) {
      if (uid == data.unBanUid) {
        util.showToast('您已被管理员 ' + data.operatorNickname + ' 解除禁言');
      } else {
        this.pushMsg(data.unBanNickname + ' 被管理员 ' + data.operatorNickname + ' 解除禁言', ROOM_TIP_MSG);
      }
    } else {
      this.pushMsg(msg, ROOM_TIP_MSG);
    }
  },
  onTi(errno, msg, data) {
    if (errno) {
      this.pushMsg(msg, ROOM_TIP_MSG);
      return;
    }

    let uid = this.data.uInfo.uid
    let that = this
    if (uid == data.tiUid) {
      // 停止视频流
      that.stopVideo()
      wx.showModal({
        content: '你已被 ' + data.operatorNickname + ' 踢出房间',
        success() {
          that.quitRoom()
        }
      })

    } else {
      this.pushMsg(data.tiNickname + ' 被 ' + data.operatorNickname + ' 踢出房间', ROOM_TIP_MSG);
    }
  },
  onUserAttention(errno, msg, data) {
    this.pushMsg(data.nickname + ' 关注了主播', ROOM_TIP_MSG);

    //刷新关注数
    let mInfo = this.data.mInfo
    this.setData({
      'mInfo.attentionNum': parseInt(mInfo.attentionNum) + 1
    })
  },
  onVideoPublishForAudience(errno, msg, data) {
    this.showLivingPage()
  },
  onVideoUnpublishForAudience(errno, msg, data) {
    this.showRestPage()
  },
  onTiModerator(errno, msg, data) {
    util.showToast(msg);
    this.stopVideo();
  },
  onChangeVideoPullUrl(errno, msg, data) {
    if (errno == 0) {
      this.setData({
        videoUrl: data.pullUrl
      })
    }
  },
  onPKStart(errno, msg, data) {
    if (errno == 0) {
      this.showPkVideo()

      this.setData({
        videoUrl: data.playUrl,
        'mInfo.isPK': true
      })
    }
  },
  onPKEnd(errno, msg, data) {
    if (errno == 0) {
      this.resizePkVideo(data)
    }
  },
  // 测试的信道服务地址
  getSocketUrl() {
    var rid = this.data.mInfo.rid

    var session = qcloud.Session.get()
    var sid = ''
    if (session) {
      sid = `&sid=${session.skey}`
    }
    var uid = app.globalData.userInfo.uid ? app.globalData.userInfo.uid : '-1'

    //return `ws://117.50.1.112:7857?uid=${uid}&rid=${rid}${sid}&platform=mp&packageId=${config.headerInfo.packageId}`
    return `wss://imweb.kuaishouvideo.com?uid=${uid}&rid=${rid}${sid}&platform=mp&packageId=${config.headerInfo.packageId}`
  },
  // 初始化系统消息，本地定时发送到公屏
  initIntervalSystemMsg() {
    var msgs = this.data.mInfo.messages
    var timeoutArr = []
    var i = 0
    var that = this
    for (const key in msgs) {
      if (msgs.hasOwnProperty(key)) {
        if (key == '60') continue

        const msg = util.filterHtml(msgs[key])

        timeoutArr[i] = setTimeout(function () {
          that.pushMsg(msg, ROOM_INTERVAL_SYSTEM_MSG)
          clearTimeout(timeoutArr[i])
        }, key * 1000)
        i++
      }
    }
  },
  updateViewer(isAdd) {
    if (isAdd) {
      // 观看人数增加
      store.onlineNum++
    } else {
      // 观看人数减少
      store.onlineNum--
    }
  },
  // 显示登录弹框
  goLogin() {
    this.setData({
      hideLoginLayer: false
    })
  },
  // 登录弹框关闭
  onLoginLayerClose() {
    this.setData({ hideLoginLayer: true })
  },
  // 通过登录弹框登录成功
  onUserLogined() {
    this.setData({
      hideLoginLayer: true,
      strongHintLoginLayer: true
    })

    // 登录成功后重新初始化socket
    this.quitSocket()
    this.initIMSocket()

    // 更新直播间内用户登录信息
    this.loginSuccessToUpdateUInfo()
  },
  // 跳转到下载页
  goDownloadPage() {
    wx.navigateTo({
      url: '/components/guide-down/guide-down'
    })
  },
  // 跳转到充值页
  goRechargePage() {
    // 阿拉丁统计
    try {
      app.aldstat.sendEvent('个人中心进充值页')
    } catch (e) {
      util.debug(e)
    }

    if (!app.globalData.isLogin) {
      this.goLogin()
      return
    }
    wx.navigateTo({
      url: '/recharge/index/index'
    })
  },
  // 显示关注提示弹框
  showFollowHintLayer() {
    this.setData({
      isHideFollowHintLayer: false
    })
  },
  // 隐藏关注提示弹框
  hideFollowHintLayer() {
    this.setData({
      isHideFollowHintLayer: true
    })
  },
  // 直接授权，不用自定义登录弹框方式，授权框内的回调
  getAuthLogin(res, successCb, failCb) {
    let errmsg = res.detail.errMsg
    let that = this
    if (errmsg === 'getUserInfo:fail auth deny') {
      //取消授权
      failCb()
    } else if (errmsg === 'getUserInfo:ok') {
      app.goLogin(() => {
        // 登录成功回调
        // 更新直播间内用户登录信息
        that.loginSuccessToUpdateUInfo()
        // 重连socket
        that.initIMSocket()
        successCb()
      })
    } else {
      wx.showToast({
        title: errmsg,
        duration: 10000,
        icon: 'none'
      })
    }

  },
  // 关注引导弹框内的授权
  followWithLoginAuth(res) {
    let that = this
    this.getAuthLogin(res, function () {
      // 授权登录成功
      that.goFollow()
    }, function () {
      // 取消授权
      wx.showToast({
        title: '已取消登录',
        icon: 'none'
      })
      return
    })
  },
  // 未登录时，底部聊天按钮的授权
  chatWithLoginAuth(res) {
    let that = this
    this.getAuthLogin(res, function () {
      // 授权登录成功
      that.showChatInputLayer()
      that.setData({
        strongHintLoginLayer: true
      })
    }, function () {
      // 取消授权
      wx.showToast({
        title: '登录后主播才会认识你哦',
        icon: 'none'
      })
      return
    })
  },
  // 未登录时，底部礼物按钮的授权
  giftsWithLoginAuth(res) {
    let that = this
    this.getAuthLogin(res, function () {
      // 授权登录成功
      that.toggleGiftsArea()
      that.setData({
        strongHintLoginLayer: true
      })
    }, function () {
      // 取消授权
      wx.showToast({
        title: '登录后才能送礼物哦',
        icon: 'none'
      })
      return
    })
  },
  // 更新直播间内用户登录信息
  loginSuccessToUpdateUInfo() {
    // 更新用户信息
    this.setData({
      uInfo: app.globalData.userInfo,
      isLogin: app.globalData.isLogin
    })
  },
  // 获取用户在直播间的停留时长, 单位s, 取整
  getStayTime() {
    var now_time = +new Date()
    return parseInt((now_time - store.stayTimeStart) / 1000)
  },
  // 获取礼物列表
  getGifts() {
    let that = this
    qcloud.request({
      url: '/index/giftList',
      data: {
        mid: this.data.mid
      },
      success(res) {
        let data = res.data
        util.debug('gifts:', data)

        let gifts = data.data.gifts
        let len = gifts.length

        let giftsSwiperArr = []
        let giftsSwiperItemArr = []

        for (let i = 0; i < len + 1; i++) {

          if ((i !== 0 && i % 8 === 0) || i === len) {
            giftsSwiperArr.push(giftsSwiperItemArr)
            giftsSwiperItemArr = []
          }

          giftsSwiperItemArr.push(gifts[i])
        }
        that.setData({
          giftsSwiperArr
        }, function () {
          that.setData({
            isHideGiftsPlaceholder: false
          })
        })
      }
    })
  },

  // 获取休息中的推荐列表
  getRecommendList() {
    let that = this
    // 默认未登录，获取热门列表
    let type = 1

    if (app.globalData.isLogin) {
      // 已经登录, 获取推荐列表
      type = 2
    }

    qcloud.request({
      url: '/index/list',
      data: {
        type,
        page: 0,
        size: 2
      },
      success: function (res) {
        console.log('recommend items:', res)
        that.setData({
          restRecommendItems: res.data.data.slice(0, 2)
        })
      },
      fail: function (err) {
        wx.showToast({
          title: `获取列表失败：${err.errMsg}`,
          icon: 'none',
          duration: 8000
        })
      }
    });
  },
  goRoom(e) {
    console.log('goroom')
    this.quitSocket()
    this.stopVideo()

    let params = e.currentTarget.dataset
    console.log('redirectTo params:', params)
    wx.redirectTo({
      url: `/room/index/index?mid=${params.mid}&videourl=${params.videourl}&headPic=${params.headpic}`
    })
  },
  // 显示休息中
  showRestPage() {
    this.getRecommendList()

    this.stopVideo()

    this.setData({
      'mInfo.isPlaying': false,
      isShowMiniVideo: true
    })
  },
  // 显示直播界面
  showLivingPage() {
    this.resumeVideo()
    this.playVideo()

    let mInfo = this.data.mInfo

    this.setData({
      'mInfo.isPlaying': true,
      videoUrl: mInfo.videoPlayUrl,
      isShowMiniVideo: true,
      hideVideoMask: true
    })
  },

  /**
   * @description 飘屏通知，付费弹幕通知
   * @author smy
   * @date 2018-10-18
   * @param {*} data
   * {
   *      headPic:'', //头像
   *      nickname: '', //昵称，标题
   *      level: '', // 等级
   *      msg: '', //通知信息
   * }
   */
  showInformDanmu(data) {

    // 初始化飘屏内的数据
    let targetData = {
      headPic: data.headPic, //头像
      nickname: data.nickname, //昵称，标题
      level: data.level, // 等级
      msg: data.msg //通知信息
    }
    let new_inform_data_len = this.data.informData.length

    this.setData({
      [`informData[${new_inform_data_len}]`]: targetData
    })

    // 初始化动画的数据
    let move_w = 2 * app.globalData.systemInfo.screenWidth
    let ani = wx.createAnimation({
      duration: 8000,
      timingFunction: 'linear',
    })
    ani.translateX(Number(`-${move_w}`)).step()

    let inform_ani_len = this.data.informAnimation.length

    // 必须延迟，等待数据节点渲染出来，才能移动对应节点
    let that = this
    setTimeout(function () {
      that.setData({
        [`informAnimation[${inform_ani_len}]`]: ani.export()
      })
    }, 200)
    return
  },
  /*举报*/
  goReport() {
    if (!this.data.isLogin) {
      this.goLogin()
    } else {
      this.toggleModeratorCard()
      wx.navigateTo({
        url: `/pages/report/report?id=${this.data.mInfo.rid}`
      })
    }
  }
})