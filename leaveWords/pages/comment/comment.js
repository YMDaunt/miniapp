var util = require('../../utils/util.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'
var app = getApp()

var store = {
    unlockMsgId: -1,
    unlockMsgIndex: -1
}

Page({
    data: {
        currentIndex: 0,
        showTask: false,
        showUnlock: false,
        receiveMsgArr: [],
        sendMsgArr: [],
        receiveMsgEnd: false,
        sendMsgEnd: false,
        scrollFlag: 0,
        // 我的积分
        myScore: -1,
        taskList: [{},{},{}]
    },
    onLoad(){
        wx.setNavigationBarTitle({
            title: '最美真心话'
        })
        this.getReceiveMsg()
        this.getMyTask()
    },
    onScrolltolower(){
        if( this.data.scrollFlag 
            || (this.data.currentIndex == 0 && this.data.receiveMsgEnd) 
            || (this.data.currentIndex == 1 && this.data.sendMsgEnd)) {
            return
        }

        this.setData({
            scrollFlag: 1
        })

        this.pageChangeToLoadData(this.data.currentIndex)

    },
    pageChange(e){
        console.log(e)
        this.setData({
            currentIndex: e.detail.current
        })
        this.pageChangeToLoadData(e.detail.current)
    },
    changeNav(e){
        console.log(e)
        this.setData({
            currentIndex: e.currentTarget.dataset.index
        })
    },
    pageChangeToLoadData(index){
        if(index == 0){
            if(this.data.receiveMsgArr.length == 0 || this.data.scrollFlag){
                this.getReceiveMsg()
            }
        }else{
            if(this.data.sendMsgArr.length == 0 || this.data.scrollFlag){
                this.getSendMsg()
            }
        }
    },
    showTaskLayer(){
        this.setData({
            showTask: !this.data.showTask
        })
    },

    async showUnlockLayer(e){
        console.log('e:', e)
        let item = e.currentTarget.dataset.item

        if(item.messageLockStatus == 1 || item.userId==app.globalData.userInfo.uid){
            // 已解锁状态或者此条留言是自己
            return
        }

        if(this.data.myScore == -1){
            try{
                await this.getMyTask()
            }catch(e){
            }
        }
        
        this.setData({
            showUnlock: !this.data.showUnlock
        })
        store.unlockMsgId = e.currentTarget.dataset.msgid
        store.unlockMsgIndex = e.currentTarget.dataset.index
        console.log('store.unlockMsgId:', store.unlockMsgId)
    },
    hideUnlockLayer(){
        this.setData({
            showUnlock: !this.data.showUnlock
        })
        store.unlockMsgId = -1
    },
    getReceiveMsg(){
        let that = this
        let len = this.data.receiveMsgArr.length
        let limit = 10
        util.showBusy('加载中')
        qcloud.request({
            url: '/game/anonymity/toMyMessage',
            data: {
                offset: len,
                limit
            },
            success(res) {
                wx.hideToast()
                that.setData({
                    scrollFlag: 0
                })

                let data = res.data
                if(data.errno == 0){
                    that.setData({
                        receiveMsgArr: that.data.receiveMsgArr.concat(data.data),
                        receiveMsgEnd: data.data.length < limit
                    })               
                }else{
                    util.showModal('获取留言失败', data.msg)
                }
            }
        })
    },

    getSendMsg(){
        let that = this
        let len = this.data.sendMsgArr.length
        util.showBusy('加载中')
        qcloud.request({
            url: '/game/anonymity/mySendMessage',
            data: {
                offset: len,
                limit: 20
            },
            success(res) {
                wx.hideToast()
                that.setData({
                    scrollFlag: 0
                })

                let data = res.data
                console.log('data:', data)
                if(data.errno == 0){
                    that.setData({
                        sendMsgArr: that.data.sendMsgArr.concat(data.data),
                        sendMsgEnd: data.data.length < 20
                    })               
                }else{
                    util.showModal('获取留言失败', data.msg)
                }
            }
        })
    },
    /**
     * @description 获取我的积分以及任务情况
     * @author smy
     * @date 2018-11-09
     */
    getMyTask(){
        let that = this
        return new Promise((resolve, reject) => {
            
            util.showBusy('获取任务中')
            qcloud.request({
                url: '/game/anonymity/getMyTask',
                success(res) {
                    wx.hideToast()
             
                    let data = res.data
                    
                    if(data.errno == 0){
                        that.setData({
                            myScore: data.data.integral,
                            taskList: data.data.taskList
                        })
                        resolve()
                    }else if(data.errno == -100){
                        app.goLogin(that.getMyTask)
                    }else{
                        util.showModal('获取任务失败', data.msg)
                    }
                }
            })
        })
    },
    /**
     * @description 做任务
     * @author smy
     * @date 2018-11-09
     * type：//1 签到 2.留言 3.邀请好友  
     */
    doMyTask(e){
        let that = this
        app.doTask({
            type: e.currentTarget.dataset.type,
            success: function(data){
                that.getTaskScore(1)
                that.setData({
                    'taskList[0].taskNum': 1
                })
            }
        })
    },

    /**
     * @description 任务积分领取按钮
     * @author smy
     * @date 2018-11-20
     * @param {*} e
     */
    finishTask(e){
        let type = parseInt(e.currentTarget.dataset.type)
        this.getTaskScore(type)
    },

    getTaskScore(type){
        let that = this
        qcloud.request({
            url: '/game/anonymity/finishTask',
            data: {
                type
            },
            method: 'POST',
            success(res) {
                let data = res.data
                if(data.errno == 0){
                    
                    that.setData({
                        myScore: data.data.integral,
                        [`taskList[${type-1}].taskStatus`]: 1
                    })

                    let this_score = type == 1 ? 1 
                                    : (type == 2 ? 3 : 2)
                    util.showToast(`任务完成，积分+${this_score}`)
                }else{
                    util.showModal('做任务失败', data.msg)
                }
            }
        })
    },

    /**
     * @description 解锁
     * @author smy
     * @date 2018-11-09
     */
    unlockMsg(){
        let that = this
        wx.showLoading({title: '解锁中'})
   
        qcloud.request({
            url: '/game/anonymity/unlockMessage',
            data: {
                messageId: store.unlockMsgId
            },
            method: 'POST',
            success(res) {
                wx.hideLoading()
         
                let data = res.data
                if(data.errno == 0){
     
                    that.setData({
                        myScore: data.data.integral,
                        [`receiveMsgArr[${store.unlockMsgIndex}].messageLockStatus`]: 1,
                        [`receiveMsgArr[${store.unlockMsgIndex}].avatarUrl`]: data.data.messager.avatarUrl,
                        [`receiveMsgArr[${store.unlockMsgIndex}].nickName`]: data.data.messager.nickName,
                        showUnlock: !that.data.showUnlock
                    })
                    util.showToast('解锁成功')
                }else if(data.errno == 1004){
                    that.setData({
                        showUnlock: !that.data.showUnlock
                    })

                    wx.showModal({
                        title: '提示',
                        content: '积分不足，去做任务获取积分？',
                        confirmText: '获取积分',
                        success(res){
                            if(res.confirm){
                                that.showTaskLayer()
                            }
                        }
                    })
                }else{
                    util.showToast(data.msg, 1500)
                }
            }
        })
    },

    onSkipMiniappSuccess(){
        console.log('跳转小程序成功')
        app.aldstat.sendEvent('成功跳转广告', {
            name: '星光小程序'
        })
    },

    onSkipMiniappFail(e){
        console.log('跳转失败:', e)
    },

    onShareAppMessage(e){
        return {
            title: '快来偷偷说出你的真心话吧！',
            path: `/pages/index/index?toUserId=${app.globalData.userInfo.uid}`,
            imageUrl: '/static/common/share.png',
            success(res){
                console.log('share:', res)
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

})