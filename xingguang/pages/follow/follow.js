var app = getApp()
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
// polyfill: async/await
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'

Page({
    data: {
        headerH: 68,
        isLogin: -1,
        items: [],
        page: 0,
		loadNextPage: false,
        isEnd: false,
        haveFollow: true
    },
    onLoad(){
        wx.hideToast()
    },
    onHeaderLoad (e) {
        this.setData({
            headerH: e.detail.headerH
        })
	},
	/*分享*/
    onShareAppMessage(res){
        return {
            title: '星光直播',
            path: '/pages/follow/follow'
        }
    },
    onLogin(){
        let that = this
        // 登录成功回调
        that.setData({
            isLogin: true
        })

        wx.startPullDownRefresh()
    },
    async onShow(){
        let loginStatus = app.globalData.isLogin
        this.setData({
            isLogin: loginStatus
        })
     
        // 如果已登录，且是第一页的时候，则拉取列表，防止多页再次拉取用第一页覆盖了所有数据
        if(loginStatus && this.data.page == 0){
            wx.startPullDownRefresh()
        }
	},
	async onPullDownRefresh() {
		this.setData({
			page: 0,
			isEnd: false
		})
		await this.getList()
		// 停止下拉动作
		wx.stopPullDownRefresh()
	},
	onReachBottom(){
		if(this.data.isEnd || this.data.loadNextPage) return

		this.data.page++
		this.setData({
			page: this.data.page,
			loadNextPage: true
		})
		this.getList()
	},
    getList(){
        if(!app.globalData.isLogin) return

		let that = this
		
		// 加载中
		this.setData({
			loadNextPage: true
		})

		qcloud.request({
			url: '/index/list',
			data: {
				type: 3,
				page: this.data.page,
				size: 5
			},
			success: function (res) {
				if(res.data.errno !== 0){
					util.showToast(res.data.msg)
					return
				}

				that.setData({
					loadNextPage: false
				})

				var isEnd = false
				if(res.data.data.length < 5){
					// 当当前页数据个数少于5个时，判定已拉取了所有的数据
					isEnd = true
				}

				var items = that.data.items
				if(that.data.page == 0){
					// 如果是第一页，先清空数据
					items = []
				}
				
				// 是否有关注主播
				var haveFollow = !(that.data.page == 0 && res.data.data.length == 0)

				that.setData({
					items: items.concat(res.data.data),
					isEnd,
					haveFollow
				})

			},
			fail: function (err) {
				wx.showToast({
					title: `获取列表失败：${err.errMsg}`,
					icon: 'none',
					duration: 8000
				})
			}
		});
	},
	goRoom(e) {
		wx.showLoading({
			title: "跳转中",
			mask: 'true'
		})
		console.log('room:', e)
		let params = e.currentTarget.dataset
		wx.navigateTo({
			url: `/room/index/index?mid=${params.mid}&videourl=${params.videourl}&headPic=${params.headpic}`
		})
	}
    
})