/* istanbul ignore next */
/*
undefined 为window下一个属性，在某些浏览器下比如IE7，可以被赋值改变
void() 用于计算一个表达式，永远返回undefined；用来代替undefined亦可减少字符数
*/
const noop = () => void(0);

let onOpen, onClose, onMessage, onError;

/* istanbul ignore next */
function listen(listener) {
    if (listener) {
        onOpen = listener.onOpen;
        onClose = listener.onClose;
        onMessage = listener.onMessage;
        onError = listener.onError;
    } else {
        onOpen = noop;
        onClose = noop;
        onMessage = noop;
        onError = noop;
    }
}

/* istanbul ignore next */
function bind() {
    wx.onSocketOpen(result => onOpen(result));
    wx.onSocketClose(result => onClose(result));
    wx.onSocketMessage(result => onMessage(result));
    wx.onSocketError(error => onError(error));
}

listen(null);
bind();

module.exports = { listen };