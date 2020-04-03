//获取应用实例
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'


Page({
    data: {
        userInfo: {},
        coin:0,//当前金币数
        songId: 0,//当前歌曲id
        indexId: 0,//当前用户第几首歌
        hasUserInfo: false,
        showTask: false,
        task: [{
                title: '每日签到',
                prize: 10,
                message: '签到',
            },
            {
                title: '好友PK胜利1场',
                prize: 10,
                message: '去PK', 
            },
            {
                title: '游戏猜对3首',
                prize: 20,
                message: '闯关',
            },
            {
                title: '分享游戏',
                prize: 20,
                message: '分享',
            },
            {
                title: '最美真心话',
                prize: 50,
                message: '领取奖励',
                type:''
            }
        ],
        limitTaskLock: false, //限时任务锁
        limitTaskStart: 0, //限时任务开始时间戳
        pkInfo: {}//好友pk邀请页面参数信息
    },
    async onLoad(query) {
        util.debug('Load:', query)
        //将好友pk邀请页面参数信息存储
        this.setData({
            pkInfo:query
        })
        // 获取小程序配置信息
        //this.getConfig()

        // 同步获取登录状态和用户信息
        try {
            //从pk邀请也退回主页一定是已登录
            if(!query.login){
                await app.checkLogin()
            }
            
            // 已登录
            this.setData({
                userInfo: app.globalData.userInfo,
                hasUserInfo: true
            })
            this.loginSuccessCb(query)
        } catch (e) {
            // 未登录
            this.setData({
                hasUserInfo: false,
                userInfo:{}
            })
        }
    },
    loginSuccessCb(query) {
        console.log('login success:', query)
        
        this.getMyInfo()
        this.getTaskInfo()
    },
    getTaskInfo:function(){
        var that = this
        qcloud.request({
            url: '/game/song/getMyTask',
            success(res) {
                util.debug('getMyTask:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    data.data.taskList.map((item, index) => {
                        that.setData({
                            [`task[${index}]`]: Object.assign(that.data.task[index], item)
                        })
                    })
                } else {
                    util.showModal('获取任务信息失败', data.msg)
                }
            }
        })
    },
    //获取用户信息
    getMyInfo:function(){
        var that = this
        qcloud.request({
            url:'/game/user/getMyUserInfo',
            success(res) {
                util.debug('MyUserInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        coin:data.data.guessSong.coin,
                        songId: data.data.guessSong.songId,
                        indexId: data.data.guessSong.indexId
                    })
                } else {
                    util.showModal('获取用户信息失败', data.msg)
                }
            }
        })
    },
    //授权登录
    getUserInfo: function(res) {
        console.log('bindgetuserinfo:', res)
        let errmsg = res.detail.errMsg
        let that = this
        if (errmsg === 'getUserInfo:fail auth deny') {
            //取消授权
            // this.failCb()
        } else if (errmsg === 'getUserInfo:ok') {
            app.goLogin(() => {
                // 登录成功回调
                console.log('login success')
                //来自好友邀请pk页面，登录后回到好友pk页面
                if (that.data.pkInfo.ald_share_src) {
                    wx.navigateTo({
                        url: '/pages/pkFriend/pkFriend?ald_share_src=' + that.data.pkInfo.ald_share_src + '&userInfo=' + that.data.pkInfo.userInfo + '&pkId=' + that.data.pkInfo.pkId,
                    })
                }
                that.setData({
                    hasUserInfo: true,
                    userInfo:app.globalData.userInfo
                })
                let params = that.data.userInfo.uid == -1 ? {} : { toUserId: that.data.userInfo.uid }
                that.loginSuccessCb(params)
            })
        } else {
            wx.showToast({
                title: errmsg,
                duration: 10000,
                icon: 'none'
            })
        }

    },
    //点击个人信息展示任务面板
    showTask: function() {
        this.setData({
            showTask: true
        })
    },
    //做任务获得金币
    finishTask:function (type){
        var that = this
            qcloud.request({
            url: '/game/song/doTask',
            data: {
                type: type,
                taskerUserId: that.data.userInfo.uid
            },
            success(res) {
                util.debug('doTask:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        coin:data.data.coin//更新金币余额
                    })
                    util.showModal('金币领取成功')
                } else {
                    util.showModal('任务完成失败', data.msg)
                }
            }
        })
    },
    //做任务
    doTask:function(e){
        let type = e.currentTarget.dataset.type
        let taskNum = e.currentTarget.dataset.taskNum
        switch(type){
            case 1:
                console.log('签到任务')
                this.finishTask(1)
                break;
            case 2:
                console.log('PK任务')
                if(taskNum>=1){
                    this.finishTask(2)
                }else{
                    wx.navigateTo({
                        url: '/pages/pk/pk'
                    })
                }
                break;
            case 3:
                console.log('闯关任务')
                if(taskNum>=3){
                    this.finishTask(3)
                }else{
                    wx.navigateTo({
                        url: '/pages/guess/guess?songId=' + this.data.songId
                    })
                }
                break;
            case 5:
                console.log('限时任务')
                var that = this;
                wx.navigateToMiniProgram({
                    appId: 'wx3e243db8c813e21e', // 要跳转的小程序的appid
                    path: '', // 跳转的目标页面
                    extarData: {},
                    success(res) {
                        that.setData({
                            limitTaskLock: true
                        })
                    },
                    fail(err) {
                        console.log(err)
                    }
                })
                break;
        }
    },
    //关闭任务面板
    closeTask: function() {
        this.setData({
            showTask: false
        })
    },
    /**
     * 生命周期函数--监听页面显示,进入前台
     */
    onShow: function() {
        if (this.data.limitTaskLock) {
            this.setData({
                limitTaskLock: false
            })
            var limitTaskEnd = +new Date()
            if (limitTaskEnd - this.data.limitTaskStart >= 20000) {
                //达到领取条件
                this.finishTask(5)
                util.showSuccess('成功领取50金币')
            } else {
                util.showModal('', '体验超过20秒才可以领取奖励')
            }
        }

    },

    /**
     * 生命周期函数--监听页面隐藏,进入后台
     */
    onHide: function() {
        if (this.data.limitTaskLock) {
            this.setData({
                limitTaskStart: +new Date()
            })
        }
    },
    //分享
    onShareAppMessage: function() {
        return {
            title: '总有一首歌是你喜欢的',
            path: '/pages/index/index',
            imageUrl: 'https://static.guojiang.tv/src/miniapp/guessSongs/index/share.jpg',
            success:res=>{
                this.finishTask(4)
            }
        }
    }
})