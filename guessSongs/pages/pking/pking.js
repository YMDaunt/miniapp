// pages/pking/pking.js
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')
const innerAudioContext = wx.createInnerAudioContext()
// import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'

Page({
    data: {
        intDiff: 3,
        showCountDown: true,//默认显示3s倒计时
        timeContent: 3,//倒计时默认3s
        countDownTimer: 0,//倒计时句柄
        timer:0,
        resultClass:['','','',''],//结果类名
        showReady: true,//显示ready
        songList: [],//全部歌曲列表
        currentSongList:[],//当前歌曲信息
        userInfo:{},//当前个人信息
        userPkInfo: {},
        userScore:0,//当前用户得分
        toUserScore:0,//朋友得分
        pkInfo: {},
        friend:{},//pk好友信息
        gameOver: false
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        // wx.getStorage({
        //     key: 'userInfo',
        //     success(res) {
        //         this.setData({
        //             userInfo:res.data
        //         })
        //     }
        // })
        this.setData({
            userInfo:app.globalData.userInfo,
            friend:JSON.parse(options.friend),
            timer: setInterval(() => {this.requestIsReady()}, 2000)
        })
        this.countDown();
        if(this.userPkInfo){
            this.getSongs();
        }else{
            setTimeout(() => {
                this.getSongs();
            }, 3000)
        }
        
        setTimeout(() => {
            this.setData({
                showReady: false
            })
        }, 1500)

    },
    //3s倒计时
    countDown: function () {
        clearInterval(this.data.countDownTimer);
        if (this.data.intDiff > 0) {
            this.setData({
                timeContent: this.data.intDiff
            })
        } else if (this.data.intDiff == 0) {
            clearInterval(this.data.countDownTimer);
            this.setData({
                showCountDown: false
            })
            return false;
        }
        this.setData({
            intDiff: --this.data.intDiff,
            countDownTimer: setTimeout(this.countDown, 1000)
        })
    },
    //轮询请求接口
    requestIsReady: function () {
        var that = this
        qcloud.request({
            url: '/game/song/currentPkInfo',
            success(res) {
                util.debug('currentPkInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    //pkstatus又回到0 pk结束
                    if (data.data.userPkInfo.pkStatus !== 0) {
                        //判断接口返回的userId是否是当前个人还是朋友
                        if(data.data.pkInfo.userId == that.data.userInfo.uid){
                            that.setData({
                                userPkInfo: data.data.userPkInfo,
                                pkInfo: data.data.pkInfo,
                                userScore:data.data.pkInfo.userScore,
                                toUserScore:data.data.pkInfo.toUserScore
                            })
                        }else{
                            that.setData({
                                userPkInfo: data.data.userPkInfo,
                                pkInfo: data.data.pkInfo,
                                userScore:data.data.pkInfo.toUserScore,
                                toUserScore:data.data.pkInfo.userScore
                            })
                        }
                    }else{
                        //停止轮询
                        clearInterval(that.data.timer)
                        //音乐停止
                        innerAudioContext.stop()
                        wx.navigateTo({
                            url: '/pages/pkResult/pkResult?pkId='+that.data.pkInfo.pkId,
                        })
                        // //查询结果
                        // that.getResult()
                    }
                        // wx.showModal({
                        //     title: '提示',
                        //     content: 'pk结束请重新开始',
                        //     showCancel:false,
                        //     success(res){
                        //         if(res.confirm){
                                    
                        //             wx.navigateTo({
                        //                 url: '/pages/pk/pk'
                        //             })
                        //         }
                        //     }
                        // })
                        
                    //  else if (data.data.userPkInfo.pkStatus === 3){
                    //     clearInterval(that.data.timer)
                    //     util.showModal('正常结束')
                    // } else if (data.data.userPkInfo.pkStatus === 4){
                    //     clearInterval(that.data.timer)
                    //     util.showModal('超时结束')
                    // }
                } else {
                    util.showModal('获取当前pk信息失败', data.msg)
                }
            }
        })
    },
    //获取歌曲信息
    getSongs:function(){
        var that = this
        qcloud.request({
            url: '/game/song/getPkSongs',
            data: {
                pkId: that.data.userPkInfo.pkId
            },
            success(res) {
                util.debug('pkSongs:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        songList:data.data.songList,
                        currentSongList:data.data.songList.shift()
                    })
                    that.palyAudio(that.data.currentSongList.file2)                   
                } else {
                    util.showModal('获取getPkSongs信息失败', data.msg)
                }
            }
        })
    },
    palyAudio: function (file) {
        innerAudioContext.stop()
        innerAudioContext.autoplay = true //自动播放
        innerAudioContext.loop = true //循环播放
        innerAudioContext.src = file
        innerAudioContext.onError((res) => {
            console.log(res.errMsg)
            console.log(res.errCode)
        })
    },
    //pk答题
    select: function (e) {
        var that = this
        var i = e.currentTarget.dataset.index
        if (e.currentTarget.dataset.item === that.data.currentSongList.answer){
            that.setData({
                [`resultClass[${i}]`]:'right'
            })
        }else{
            that.setData({
                [`resultClass[${i}]`]: 'wrong'
            })
        }
        qcloud.request({
            url: '/game/song/pkAnswer',
            data: {
                pkId: that.data.userPkInfo.pkId,
                songId:that.data.currentSongList.id,
                answer: e.currentTarget.dataset.item
            },
            success(res) {
                util.debug('pkAnswer:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        currentSongList:that.data.songList.shift(),
                        resultClass: ['', '', '', '']
                    })
                    that.palyAudio(that.data.currentSongList.file2)
                } else {
                    util.showModal('获取getPkAnswer信息失败', data.msg)
                }
            }
        })
    },
    //请求pk结果
    getResult:function(){
        var that = this
        qcloud.request({
            url: '/game/song/pkResult',
            data: {
                pkId: that.data.userPkInfo.pkId
            },
            success(res) {
                util.debug('pkResult:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    
                } else {
                    util.showModal('获取getPkResult信息失败', data.msg)
                }
            }
        })
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {

    }
})