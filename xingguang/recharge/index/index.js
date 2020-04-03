var app = getApp()
var util = require('../../utils/util.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')

Page({
    data: {
        url: ''
    },
    onShow(){
        let session = qcloud.Session.get()
        this.setData({
            url: `https://m.kuaishouvideo.com/rechargeApp?platform=mp&skey=${session.skey}`
        })
    },
    /*分享*/
    onShareAppMessage(res){
        return {
            title: '星光直播',
            path: '/recharge/index/index'
        }
    },
    onLoad (query) {
    },
    onMessage(e){
        util.debug('webview post message:', e)
        let len = e.detail.data.length
        if(len > 0){
            let coin = e.detail.data[len-1].coin
            app.globalData.userInfo.coin = coin
        }
    }

  })