//app.js
const ald = require('./utils/ald-stat.js')
const util = require('./utils/util.js')
const qcloud = require('./vendor/wafer2-client-sdk/index.js')
const config = require('./config.js')

App({
    globalData: {
        userInfo: null,
        isLogin: false
    },
    onLaunch: function() {
        //网络检查提示
        wx.getNetworkType({
            success(res) {
                util.debug('res.networkType :', res.networkType)
                if (res.networkType == 'none') {
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }
            }
        })

        wx.onNetworkStatusChange(function(res) {
            console.log(res.isConnected)
            console.log(res.networkType)
            if (!res.isConnected || res.networkType == 'none') {
                util.showToast('请检查网络连接是否正常')
            }

            if (res.networkType == '2g') {
                util.showToast('网络较慢')
            }
        })

        // 获取系统信息
        this.getSystemInfo()

        // 设置登录地址
        qcloud.setLoginUrl(config.service.loginUrl)
    },
    /**
     * @description 检测登录态， 联合wx.checkSession 和 本地skey检查
     * @author smy
     * @date 2018-11-09
     */
    checkLogin() {
        let app = this
        return new Promise((resolve, reject) => {
            wx.checkSession({
                success() {
                    //session_key 未过期，并且在本生命周期一直有效
                    var session = qcloud.Session.get()
                    if (session && session.skey) {
                        // 已登录
                        app.globalData.isLogin = true
                        app.globalData.userInfo = session.userInfo
                        // wx.setStorage({
                        //     key: 'userInfo',
                        //     data: session.userInfo
                        // })
                        resolve(true)
                    } else {
                        // 登录态失效
                        app.globalData.isLogin = false
                        app.globalData.userInfo = null
                        reject({
                            code: -1002,
                            msg: 'skey失效'
                        })
                    }
                },
                fail() {
                    // session_key 已经失效，需要重新执行登录流程
                    // 登录态失效
                    app.globalData.isLogin = false
                    app.globalData.userInfo = null
                    reject({
                        code: -1001,
                        msg: 'checkSession失败'
                    })
                }
            })
        })
    },
    getSystemInfo() {
        let app = this
        // 获取设备信息
        wx.getSystemInfo({
            success(res) {
                util.debug('getSystemInfo:', res)
                app.globalData.systemInfo = res

                if (/iPhone|iPod|iPad/.test(res.model)) {
                    // 苹果设备
                    app.globalData.platform = 'ios'
                }
                // config中备份一份，供登录时使用
                config.headerInfo.platform = app.globalData.platform
            }
        })
    },
    goLogin(successCb, failCb) {
        let app = this
        return new Promise((resolve, reject) => {
            util.showBusy('登录中')

            // 无论是不是首次登录，都获取加密数据发送到后台，方便更新用户的微信数据
            qcloud.login({
                success: res => {
                    // 阿拉丁统计，群分享需要
                    let session = qcloud.Session.get()
                    if (session && session.skey) {
                        app.aldstat.sendSession(session.skey)
                        app.aldstat.sendOpenid(res.userId)
                    }

                    // 更新登录后的状态
                    app.globalData.isLogin = true
                    app.globalData.userInfo = res.userInfo

                    util.showSuccess('登录成功')

                    // 执行登陆成功后的回调
                    successCb && successCb()
                    resolve()
                },
                fail: err => {
                    console.error('goLogin登录失败：', err)
                    //wx.hideToast()
                    util.showModal('登录错误', err)
                    // 执行登陆失败后的回调
                    failCb && failCb(err)
                    reject()
                }
            })

        })
    },
    logout() {
        qcloud.Session.clear()
        this.globalData.isLogin = false
        this.globalData.userInfo = {}
    }
})