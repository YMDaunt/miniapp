var app = getApp()

Component({
    properties: {
        title: {
            type: String,
            value: '',
            observer: function(newval, oldval, changePath){}
        },
        showBack: {
            type: Boolean,
            value: false,
            observer: function(newval, oldval, changePath){}
        }
    },
    data: {
        defaulTitle: "星光直播",
        statusBarH: 0,
        titleBarH: 0
    },
    ready: function(){
        this.setData({
            statusBarH: app.globalData.statusBarHeight,
            titleBarH: app.globalData.titleBarHeight
        })

        // 提供给page header的高度，在header需要绝对定位时，可以用来页面距离顶部的定位
        this.triggerEvent('headerload', {
            headerH: app.globalData.statusBarHeight + app.globalData.titleBarHeight
        })
    },
    methods: {
    }
})