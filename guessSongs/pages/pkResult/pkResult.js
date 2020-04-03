// pages/pkResult/pkResult.js
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')
Page({
    data: {
        me: {},
        friend: {},
        result: '',
        userInfo: {}, //当前用户的信息
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function(options) {
        this.setData({
            userInfo:app.globalData.userInfo
        })
        this.getResult(options.pkId)
    },

    //请求pk结果
    getResult: function(pkId) {
        var that = this
        qcloud.request({
            url: '/game/song/pkResult',
            data: {
                pkId: pkId
            },
            success(res) {
                util.debug('pkResult:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    if (data.data.pkResult){
                        if(data.data.pkResult.user.nickName === that.data.userInfo.nickName){
                            that.setData({
                                me: data.data.pkResult.user,
                                friend: data.data.pkResult.toUser,
                            })    
                        }else{
                            that.setData({
                                friend: data.data.pkResult.user,
                                me: data.data.pkResult.toUser,
                            })
                        }
                    }
                    if (that.data.userInfo.uid === data.data.pkResult.winnerUserId){
                        that.setData({
                            result:'win'
                        })
                    } else if (data.data.pkResult.winnerUserId === 0){
                        //平局
                        that.setData({
                            result: 'tie'
                        })
                    }else{
                        that.setData({
                            result: 'fail'
                        })
                    }
                } else {
                    util.showModal('获取getPkResult信息失败', data.msg)
                }
            }
        })
    },
    //继续挑战
    continue:function(){
        wx.navigateTo({
            url: '/pages/pk/pk'
        })
    },
    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function() {

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
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function() {
        return {
            title: '总有一首歌是你喜欢的',
            path: '/pages/index/index',
            imageUrl: 'https://static.guojiang.tv/src/miniapp/guessSongs/index/share.jpg',
        }
    }
})