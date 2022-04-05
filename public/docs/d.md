---
tags: Bla bla
title: D
---

# 部署私有 codimd 踩坑总结

1. 在阿里云上部署服务，如果域名没有备案的话会被拦截

2. 依赖中 `markdown-pdf` 依赖了 PhantomJS，但是在 raspberry pi 的架构上无法安装该 npm 包，因此通过删除 package.json 中的依赖以及代码中对 `markdown-pdf` 的依赖解决

3. ==在 raspberry pi 上启动 node 服务时报了 `ENOSPC: System limit for number of file watchers reached` 这个错，原因是监听的文件数超过了系统限制==，只需要修改该限制即可，如下：
    1. `sudo vim /etc/sysctl.conf`

    2. 添加这一行 `fs.inotify.max_user_watches=524288`，修改监听文件数到最大

    3. `sudo sysctl -p` 立即生效，否则不会立即生效

    > 参考 https://www.nicesnippets.com/blog/solved-system-limit-for-number-of-file-watchers-reached-reactjs。

1. 配合 nps 的 http Basic 验证（简称 BA），出现的验证缓存问题。https://en.wikipedia.org/wiki/Basic_access_authentication
    1. http 的 BA 是在浏览器中有缓存的，但不同浏览器的缓存策略不同，也可以通过 js 手动清除

    2. http 的 BA 是通过服务端的 `WWW-Authenticate: Basic realm="User Visible Realm"` 头来提示用户验证，浏览器会自动弹出验证框

    3. 客户端的 `Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==` 头来验证，Basic 后面的字符串就是 `用户名:密码` 的 base64 格式

2. 如果在 nps 配置中已经有了指定「域名解析」，无需再 npc 客户端配置中再添加，或者 nps 配置中不存在，只需要在 npc 中添加，即==nps、npc 两者只需要在一个地方添加「域名解析」即可==

3. 解决使用 nps 内网穿透后无法使用 websocket 的问题。https://github.com/ehang-io/nps/issues/502，学到了用 nginx 配置 ws 代理的做法，以及用 tcp 隧道代理 http 服务

4. 配置 systemd service 配置
    1. 最好放在 `/etc/systemd/system` 目录下，放在用户级目录不好使

    2. 可以使用 `sudo systemd-analyze verify npc.service` 命令诊断配置的正确性

5. systemd 的日志，无需单独配置，可以直接使用 ==journalctl== 命令查看