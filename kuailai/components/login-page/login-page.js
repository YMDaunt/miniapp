/** 
 * 登录页面
*/
var app = getApp()
var util = require('../../utils/util.js')

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
    },
    ready: function(){
    },
    methods: {
        login(res) {
            util.debug('loginBtn bindgetuserinfo:', res)
            let errmsg = res.detail.errMsg
            if( errmsg=== 'getUserInfo:fail auth deny'){
                wx.showToast({
                    title: '已取消登录',
                    icon: 'none'
                })
                return
            }else if(errmsg === 'getUserInfo:ok'){
                app.goLogin(() => {
                    // 登录成功回调
                    this.triggerEvent('logined')
                })
            }else{
                wx.showToast({
                    title: errmsg,
                    duration: 10000,
                    icon: 'none'
                })
            }
            
        }
    }
})