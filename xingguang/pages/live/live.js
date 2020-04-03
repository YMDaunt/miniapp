Page({
    data: {
        imgs: []
    },
    onLoad(res){
        var that = this
        var imgs = [
            'https://static.guojiang.tv/src/miniapp/live/0_01.jpg',
            'https://static.guojiang.tv/src/miniapp/live/0_02.jpg',
            'https://static.guojiang.tv/src/miniapp/live/0_03.jpg',
            'https://static.guojiang.tv/src/miniapp/live/0_04.jpg'
        ]
        wx.showLoading({
            title: '加载中...'
        })
        for (const key in imgs) {
            
            if (imgs.hasOwnProperty(key)) {
                let img = imgs[key];

               /*  wx.getImageInfo({
                    src: img,
                    success (res) {
                        
                    }
                }) */
                that.setData({
                    [`imgs[${key}]`]: img
                })
            }
        }
        
        wx.hideLoading()
    },
    /*分享*/
    onShareAppMessage(res){
        return {
            title: '星光直播',
            path: '/pages/live/live'
        }
    }
})