// pages/pkFriend/pkFriend.js
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'


Page({
    data: {
        userInfo: {},
        showRules: '',//展示规则
        isReady:false,//默认未准备
        userPkInfo:{},//轮询pk信息
        countDownNum:20,//20s倒计时
        timer:0,//轮询定时器
        friend: {}
    },

    /**
     * 生命周期函数--监听页面加载
     */
    async onLoad(query) {
        util.debug('Load:', query)
        // 同步获取登录状态和用户信息
        try {
            await app.checkLogin()
            // 已登录
            this.setData({
                userInfo: app.globalData.userInfo,
                hasUserInfo: true,
                friend: JSON.parse(query.userInfo)
            })
            // this.loginSuccessCb(query)
        } catch (e) {
            wx.navigateTo({
                url: '/pages/index/index?ald_share_src=' + query.ald_share_src+'&userInfo=' + query.userInfo,
            })
        }
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
    },
    //点击准备pk按钮
    ready:function(){
        var that = this
        console.log(that.data.userInfo.uid)
        qcloud.request({
            url: '/game/song/readyPK',
            data:{
                sourceUserId:that.data.friend.uid
            },
            success(res) {
                util.debug('readyPK:', res.data)
                let data = res.data
                if (data.errno == 0) {
                   that.setData({
                       isReady:true
                   })
                    //开始倒计时
                    let count_down = setInterval(()=>{
                        if (that.data.countDownNum > 0) {
                            that.setData({
                                countDownNum:--that.data.countDownNum
                            })
                        } else {
                            clearInterval(count_down)
                        }
                    }, 1000)
                    that.setData({
                        timer: setInterval(() => {that.requestIsReady()}, 3000)
                    })
                } else {
                    util.showModal('准备pk失败', data.msg)
                }
            }
        })
    },

    //轮询是否开始pk
    requestIsReady: function () {
        var that = this
        qcloud.request({
            url: '/game/song/currentPkInfo',
            success(res) {
                util.debug('currentPkInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        userPkInfo: data.data.userPkInfo
                    })
                    //对战中
                    if (data.data.userPkInfo.pkStatus === 2) {
                        clearInterval(that.data.timer)
                        wx.navigateTo({
                            url: '/pages/pking/pking?friend='+JSON.stringify(that.data.friend)
                        })
                    }
                } else {
                    util.showModal('获取当前pk信息失败', data.msg)
                }
            }
        })
    },

    //放弃PK
    giveup: function () {
        clearInterval(this.data.timer)
        wx.navigateTo({
            url: '/pages/index/index?login=true'
        })
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

    //分享
    onShareAppMessage: function () {
        return {
            title: '总有一首歌是你喜欢的',
            path: '/pages/index/index',
            imageUrl: 'https://static.guojiang.tv/src/miniapp/guessSongs/index/share.jpg',
        }
    }
})