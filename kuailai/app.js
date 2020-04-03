const ald = require('./utils/ald-stat.js')
var util = require('./utils/util.js')
var qcloud = require('./vendor/wafer2-client-sdk/index.js')
var config = require('./config.js')
import regeneratorRuntime from './vendor/regenerator-runtime/runtime'

var startTime = Date.now();//启动时间


//app.js
App({
	globalData: {
		isLogin: false,
		userInfo: {},
		statusBarHeight: 20,
		titleBarHeight: 48,
		platform: 'android',
		systemInfo: {},
		mode: 1 // 是否是审核模式， 0：非审核模式 1：审核模式
	},
	onShow(){
		// 比如记录小程序启动时长
		this.aldstat.sendEvent('小程序的启动时长',{
			time : Date.now() - startTime
		})
	},
	async onLaunch () {
		console.log('app:', this)
		wx.getNetworkType({
            success(res){
                console.log('res.networkType :', res.networkType )
                if(res.networkType == 'none'){
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }
            }
		})
		
		// 显示界面加载loading
		util.showBusy('正在加载')

		// 获取系统信息，计算导航栏高度
		this.getSystemInfo()

		// 获取小程序配置信息，审核模式
		this.initConfig()

		// 设置登录地址
		qcloud.setLoginUrl(config.service.loginUrl)

		// 检查是否是登录状态
		await this.checkLogin().catch()
		
	},

	getSystemInfo(){
		let app = this
		// 获取设备信息
		wx.getSystemInfo({
			success(res){
				console.log('res:', res)
				app.globalData.systemInfo = res
				
				// 计算顶部导航栏高度
				let totalTopHeight = 68
				if (res.model.indexOf('iPhone X') !== -1) {
					totalTopHeight = 88
				} else if (res.model.indexOf('iPhone') !== -1) {
					totalTopHeight = 64
				}else if(res.platform == 'android'){
					// 兼容安卓留海机，比如华为荣耀10
					totalTopHeight = res.statusBarHeight > 24 ? totalTopHeight + 6 : totalTopHeight
				}
				app.globalData.statusBarHeight = res.statusBarHeight
				app.globalData.titleBarHeight = totalTopHeight - res.statusBarHeight
        
        console.log(app.globalData.statusBarHeight, app.globalData.titleBarHeight)

				if (/iPhone|iPod|iPad/.test(res.model)) {
                    // 苹果设备
                    app.globalData.platform = 'ios'
				}
			}
		})
	},
	checkLogin(){
		let app = this
		return new Promise((resolve, reject) => {
			qcloud.request({
				url: '/user/check',
				success(res){
					util.debug('user/check:', res)
					var data = res.data
					
					// 更新登录状态
					app.globalData.isLogin = data.data.loginState === 1

					// 更新session用户信息
					if(data.data.loginState === 1){
						let session = qcloud.Session.get()
						if(session){
							session.userInfo = data.data.userInfo
							qcloud.Session.set(session)

							// 登录成功，更新全局用户信息
							app.globalData.userInfo = data.data.userInfo
						}
					}
	
					resolve(data.data.loginState)
				},
				fail(data){
					reject('检查登录状态失败: '+ data)
				}
			})

		})
	},

	goLogin (successCb, failCb) {
		let app = this
		
		util.showBusy('登录中')

		// 无论是不是首次登录，都获取加密数据发送到后台，方便更新用户的微信数据
		qcloud.login({
			success: res => {
				// 阿拉丁统计，群分享需要
				let session = qcloud.Session.get()
				if(session && session.skey){
					app.aldstat.sendSession(session.skey)
					app.aldstat.sendOpenid(session.userInfo.openid)
				}

				// 更新登录后的状态
				app.globalData.isLogin = true
				app.globalData.userInfo = res
				util.showSuccess('登录成功')
				
				// 执行登陆成功后的回调
				successCb && successCb()
			},
			fail: err => {
				console.error(err)
				wx.hideToast()
				//util.showModal('登录错误', err.message)
				// 执行登陆失败后的回调
				failCb && failCb()
			}
		})
	},

	logout(){
		qcloud.Session.clear()
		this.globalData.isLogin = false
		this.globalData.userInfo = {}
	},

	initConfig(){
		let app = this
		qcloud.request({
			url: '/index/verifyInfo',
			success(res){
				let data = res.data
				if(data.errno == 0){
					if(app.globalData.platform == 'android'){
						app.globalData.mode = 0
					}else{
						app.globalData.mode = data.data.isVerify
					}
				}else{
					util.debug(data.msg)
					util.showToast(data.msg)
				}
			}
		})
	}

})