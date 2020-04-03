var app = getApp()
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'

Page({
    data: {
        userInfo: {},
        isLogin: false,
        lock: true,
        mode: 1
    },
    onLoad(){
        wx.hideToast()
        this.setData({
            mode: app.globalData.mode
        })
    },
    /*分享*/
    onShareAppMessage(res){
        return {
            title: '快来直播秀',
            path: '/pages/usercenter/usercenter'
        }
    },
    onShow(){
        wx.startPullDownRefresh()
    },       
    async onPullDownRefresh() {   
        var status = await app.checkLogin().catch((res) => {
            console.log('res:', res)
        })

        if(status === 1){
            this.updateUserinfo()
            this.setData({
                lock: false
            })
        }else{
            this.setData({
                userInfo: {},
                isLogin: false,
                lock: false
            })
        }
        
        // 停止下拉动作
        wx.stopPullDownRefresh()
    },
    onLogin(){
        // 登录成功回调
        this.setData({
            isLogin: true,
            lock: false
        })
        this.updateUserinfo()
    },
    updateUserinfo(){
        this.setData({
            isLogin: app.globalData.isLogin,
            userInfo: app.globalData.userInfo
        })
    },
    logout(){
        app.logout()
        this.updateUserinfo()
    },
    goRecharge(){
        // app.aldstat.sendEvent('个人中心进充值页')
    }
})