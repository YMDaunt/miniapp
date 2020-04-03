/**
 * 小程序配置文件
 */

// 此处主机域名修改成腾讯云解决方案分配的域名]

var host = 'https://mpg.kuaishouvideo.com';

var config = {
    // header内的小程序包信息
    headerInfo: {
        version: '1.0.0',
        product: 'guessSong',
        platform: ''
    },
    // 下面的地址配合云端 Demo 工作
    service: {
        host,

        // 登录地址，用于建立会话
        loginUrl: `${host}/game/user/login`,

        // 测试的请求地址，用于测试会话
        requestUrl: `${host}/weapp/user`,

        // 上传图片接口
        uploadUrl: `${host}/weapp/upload`
    }
};

module.exports = config;
