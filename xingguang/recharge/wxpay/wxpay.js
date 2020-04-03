var util = require('../../utils/util.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')

Page({
	data: {
		payStatus: '加载支付中...',
		money: 0
	},
	onLoad(query) {
		let that = this
		console.log('query:', query)
		this.createOrder(query.money)
		this.setData({
			money: query.money
		})
	},

	createOrder(money){
		let that = this

		util.showBusy('开始创建订单')
		qcloud.request({
			url: '/recharge/createOrder',
			data: {
				money
			},
			method: 'POST',
			success(res){
				util.showBusy('创建订单成功')
				let data = res.data
				if(data.errno == 0){
					let orderId = data.data.payId
					// 获取支付参数
					that.getWxPayData(orderId)
				}else if(data.errno != -100){
					util.showToast(data.msg, 10000)
					that.failAndGoBack()
				}
			},
			fail(res){
				util.showToast(res.errMsg)
				that.failAndGoBack()
			}
		})
	},
	getWxPayData(orderId){
		let that = this

		util.showBusy('获取支付参数')
		qcloud.request({
			url: '/recharge/wxPay',
			data: {
				payId: orderId
			},
			method: 'POST',
			success(res){
				util.showBusy('获取参数成功')
				let data = res.data
				if(data.errno == 0){
					let params = data.data
					// 开始调起支付
					that.goPay(orderId, params)
				}else if(data.errno != -100){
					util.showToast(data.msg, 10000)
					that.failAndGoBack()
				}
			},
			fail(res){
				util.showToast(res.errMsg)
				that.failAndGoBack()
			}
		})
	},

	goPay(orderId, data){
		let that = this

		console.log('data:',data)
		util.showBusy('调起支付中')
		wx.showToast({
			title: '安全支付中',
			icon: 'loading',
			duration: 1000000
		})
		wx.requestPayment({
			'timeStamp': String(data.timeStamp),
			'nonceStr': data.nonceStr,
			'package': data.package,
			'signType': data.signType,
			'paySign': data.sign,
			'success':function(res){
				console.log('res:', res)
				if(res.errMsg === 'requestPayment:ok'){
					util.showSuccess('支付成功')
					that.setData({
						payStatus: '支付成功'
					})
				}else{
					util.showToast(res.errMsg, 3000)
				}
				// 轮询支付结果
				that.checkPayResult(orderId, function(){
					var pages = getCurrentPages()
					var prevPage = pages[pages.length - 2]

					// 必须跳转到一个和之前页面不一样的url，这样navigateBack后才会刷新页面
					prevPage.setData({
						url: `https://m.kuaishouvideo.com/rechargeApp`
					})
		
					wx.navigateBack()
				})

			},
			'fail':function(res){
				console.log('fail res:', res)
				if(res.errMsg === 'requestPayment:fail cancel'){
					util.showToast('支付已取消', 3000)
					that.failAndGoBack(1500)
				}else{
					util.showToast(res.errMsg, 10000)
					that.failAndGoBack()
				}
				
			},
			'complete':function(res){
				console.log('complete res:', res)
			}
		})
	},

	checkPayResult(orderId, successCb){
		let that = this
		util.showBusy('校验支付结果')
		loop()

		function loop() {
			qcloud.request({
				url: '/recharge/wxPayResult',
				data: {
					payId: orderId
				},
				method: 'POST',
				success(res){
					let data = res.data
					if(data.errno == 0){
						if(data.data.status === 1){
							// 支付成功
							util.showSuccess('充值成功')
							that.setData({
								payStatus: '充值成功'
							})

							setTimeout(function(){
								successCb()
							}, 2000)
						}else{
							setTimeout(() => {
								loop()
							}, 200);
						}
					}else if(data.errno != -100){
						util.showModal(data.msg, '请尝试返回并刷新页面或重启小程序')
					}
				}
			})
		}
		
	},

	failAndGoBack(time){
		time = time || 3000
		setTimeout(function(){
			wx.navigateBack()
		}, time)
	}
	
})