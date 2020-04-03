const ald = require('./utils/ald-stat.js')
var util = require('./utils/util.js')
var qcloud = require('./vendor/wafer2-client-sdk/index.js')
var config = require('./config.js')
var startTime = Date.now();//启动时间
//app.js
App({
	globalData: {
		userInfo: null,
		isLogin: false,
		wxname: "偷偷对我说",
		platform: 'android',
		systemInfo: {}
    },
    onShow(query){
        console.log('app onShow:', query)
        // 比如记录小程序启动时长
		this.aldstat.sendEvent('小程序的启动时长',{
			time : Date.now() - startTime
		})
    },
	onLaunch (query) {
        console.log('onLaunch:', query)
		// 设置导航栏名字
		wx.setNavigationBarTitle({
			title: this.globalData.wxname
		})

		wx.getNetworkType({
            success(res){
                util.debug('res.networkType :', res.networkType )
                if(res.networkType == 'none'){
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }
            }
        })
        
        wx.onNetworkStatusChange(function (res) {
            console.log(res.isConnected)
            console.log(res.networkType)
            if(!res.isConnected || res.networkType == 'none'){
                util.showToast('请检查网络连接是否正常')
            }

            if(res.networkType == '2g'){
                util.showToast('网络较慢')
            }
        }) 
		
		// 显示界面加载loading
		//util.showBusy('正在加载')

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
	checkLogin(){
        let app = this
        return new Promise((resolve, reject) => {

            wx.checkSession({
                success () {
                    //session_key 未过期，并且在本生命周期一直有效
                    var session = qcloud.Session.get()
                    if(session && session.skey){
                        // 已登录
                        app.globalData.isLogin = true
                        app.globalData.userInfo = session.userInfo
                        resolve(true)
                    }else{
                        // 登录态失效
                        app.globalData.isLogin = false
                        app.globalData.userInfo = null
                        reject({code: -1002, msg: 'skey失效'})
                    }
                },
                fail () {
                    // session_key 已经失效，需要重新执行登录流程
                    // 登录态失效
                    app.globalData.isLogin = false
                    app.globalData.userInfo = null
                    reject({code: -1001, msg: 'checkSession失败'})
                }
            })
        })
	},
	getSystemInfo(){
		let app = this
		// 获取设备信息
		wx.getSystemInfo({
			success(res){
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
	goLogin (successCb, failCb) {
		let app = this
		return new Promise((resolve, reject) => {
            util.showBusy('登录中')
    
            // 无论是不是首次登录，都获取加密数据发送到后台，方便更新用户的微信数据
            qcloud.login({
                success: res => {
                    // 阿拉丁统计，群分享需要
                    let session = qcloud.Session.get()
                    if(session && session.skey){
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
                    util.showModal('登录错误', err.message)
                    // 执行登陆失败后的回调
                    failCb && failCb(err)
                    reject()
                }
            })

        })
	},

	logout(){
		qcloud.Session.clear()
		this.globalData.isLogin = false
		this.globalData.userInfo = {}
    },
    
    /**
     * @description 做任务
     * @author smy
     * @date 2018-11-09
     * type：//1 签到 2.留言 3.邀请好友  
     */
    doTask(obj){
        let app = this

        var options = {
            type: 0,
            doTaskUid: app.globalData.userInfo.uid,
            success: null
        }
        options = util.extend(options, obj)

        // 增加签到统计
        if(options.type == 1){
            app.aldstat.sendEvent('签到')
        }

        qcloud.request({
            url: '/game/anonymity/doTask',
            data: {
                type: options.type,
                taskerUserId: options.doTaskUid
            },
            method: 'POST',
            success(res) {
                let data = res.data
                if(data.errno == 0){
                    options.success(data)
                    let score = data.data.integral
                    if(score >= 6){
                        app.aldstat.sendEvent('任务全部完成')
                    }
                }else if(data.errno != 1001){
                    util.showModal('做任务失败', data.msg)
                }
            }
        })
    }
})