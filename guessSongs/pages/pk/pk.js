// pages/pk/pk.js
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')

Page({

    /**
     * 页面的初始数据
     */
    data: {
        userInfo: {},
        showRules: '', //展示规则
        showStartBtn:false,//是否显示开始对战按钮
        countDownNum: 20,//20s倒计时
        userPkInfo:{},
        pkInfo:{},
        friend:{
            nickName:'jesse131'
        },//pk好友信息
        timer:''//定时器
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function(options) {
        // this.requestIsReady()
        this.initPK()
        this.setData({
            userInfo: app.globalData.userInfo,
            timer: setInterval(() => { this.requestIsReady() }, 2000)
        })
        try {
            var value = wx.getStorageSync('showRules')
            if (value) {
                this.setData({
                    showRules: false
                })
            } else {
                this.setData({
                    showRules: true
                })
                wx.setStorage({
                    key: "showRules",
                    data: "false"
                })
            }
        } catch (e) {
            alert(e)
        }
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function() {

    },
    //点击关闭pk规则
    know: function() {
        this.setData({
            showRules: false
        })
    },
    //放弃PK
    giveup: function() {
        clearInterval(this.data.timer)
        wx.navigateTo({
            url: '/pages/index/index?login=true'
        })
    },
    //开始PK
    start: function() {
        var that = this
        qcloud.request({
            url: '/game/song/acceptPk',
            data:{
                pkId:that.data.userPkInfo.pkId
            },
            success(res) {
                util.debug('acceptPk:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    clearInterval(that.data.timer)
                    wx.navigateTo({
                        url: '/pages/pking/pking?friend=' + JSON.stringify(that.data.friend)
                    })
                } else {
                    util.showModal('开始pk失败', data.msg)
                }
            }
        })
        
    },
    initPK:function(){
        var that = this
        qcloud.request({
            url: '/game/song/beginPk',
            success(res) {
                util.debug('initPkInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                   
                } else {
                    util.showModal('初始化pk失败', data.msg)
                }
            }
        })
    },
    //请求好友是否已准备
    requestIsReady:function(){
        var that = this
        qcloud.request({
            url: '/game/song/currentPkInfo',
            success(res) {
                util.debug('currentPkInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        userPkInfo: data.data.userPkInfo,
                        pkInfo: data.data.pkInfo
                    })
                    //好友已准备
                    if(data.data.userPkInfo.pkStatus === 1){
                        that.setData({
                            showStartBtn:true
                        })
                        //开始倒计时
                        let count_down = setInterval(() => {
                            if (that.data.countDownNum > 0) {
                                that.setData({
                                    countDownNum: --that.data.countDownNum
                                })
                            } else {
                                clearInterval(count_down)
                            }
                        }, 1000)
                    }
                } else {
                    util.showModal('获取当前pk信息失败', data.msg)
                }
            }
        })
    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function() {
        let that = this
        return {
            title: '试试看能不能赢了我',
            path: '/pages/pkFriend/pkFriend?userInfo=' + JSON.stringify(app.globalData.userInfo),
            imageUrl: 'https://static.guojiang.tv/src/miniapp/guessSongs/index/share.jpg',
            success:function(){
                that.setData({
                    timer: setInterval(() => { this.requestIsReady() }, 2000)
                })
            }
        }
        
    }
})