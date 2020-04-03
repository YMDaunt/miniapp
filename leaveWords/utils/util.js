const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : '0' + n
}

// 显示toast提示
var showToast = (text, time) => {
    text = typeof(text) === 'string' ? text : JSON.stringify(text)
    wx.showToast({
        title: text,
        icon: 'none',
        duration: time || 3000
    })
}

// 显示繁忙提示
var showBusy = text => {
    text = typeof(text) === 'string' ? text : JSON.stringify(text)
    wx.showToast({
        title: text,
        icon: 'loading',
        duration: 10000
    })
}

// 显示成功提示
var showSuccess = text => {
    text = typeof(text) === 'string' ? text : JSON.stringify(text)
    wx.showToast({
        title: text,
        icon: 'success'
    })
}

// 显示失败提示
var showModal = (title, content) => {
    wx.hideToast();

    if(content){
        content = typeof(content) == 'string' ? content : content.toString()
    }
    wx.showModal({
        title,
        content: content || '',
        showCancel: false
    })
}


var debug = (msg, obj) => {
    if (console && console.log) {
        if (typeof msg == 'string') {
            var d = new Date;
            var tip = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + ' ' + msg
            if(obj === undefined){
                console.log(tip);
            }else{
                //obj = typeof(obj) == 'string' ? JSON.parse(obj) : obj
                console.log(tip, obj);
            }
        } else {
            console.log(msg);
        }
    }
}

/** 
 * 过滤http为https
*/
var filterHttp = function(str){
    if (str) {
        var regExp = new RegExp("^http:", "i")
        return str.replace(regExp, 'https:')
    }
}

/** 
 * 过滤html标签
 * 场景：直播间系统消息，过滤html标签
*/
var filterHtml = function(str){
    if(str == undefined) return

    str = typeof(str) == 'string' ? str : JSON.stringify(str)

    return str.replace(/<[^>]*>/ig, '')
}

/**
 * 拓展对象
 */
var extend = function extend(target) {
    var sources = Array.prototype.slice.call(arguments, 1);

    for (var i = 0; i < sources.length; i += 1) {
        var source = sources[i];
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }

    return target;
};

module.exports = { 
    formatTime,
    showToast,
    showBusy,
    showSuccess,
    showModal,
    debug,
    filterHttp,
    filterHtml,
    extend
}
