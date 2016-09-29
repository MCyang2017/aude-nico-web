
### 技术栈

- Koa 2
- nodemon + runkoa（支持async/await，且不需关心babel）
- pm2 for deployment（服务器部署）
- ejs
- mongodb
- elasticsearch

### 开始

```
npm install
npm start
```

http://127.0.0.1:3000/

### 部署

pm2部署

```
 #npm run pm2
 pm2 start bin/run

```

### 配置 mongodb & elasticsearch
##### 0.安装 mongodb
```
apt-get update
```

```
apt-get install mongodb
```

```
/etc/init.d/mongodb start
```
##### 1.配置 mongodb

```
cd /usr/bin
```
```
./mongod --port 28010 --oplogSize 10 --dbpath=/mongoData/data/r0/ --logpath=/mongoData/log/r0.log --replSet rs1/127.0.0.1:28011,127.0.0.1:28012 --maxConns 800 --fork --logappend
```

```
./mongod --port 28012 --oplogSize 10 --dbpath=/mongoData/data/r2/ --logpath=/mongoData/log/r2.log --replSet rs1/127.0.0.1:28010,127.0.0.1:28011 --maxConns 800 --fork --logappend
```

```
./mongod --port 28011 --oplogSize 10 --dbpath=/mongoData/data/r1/ --logpath=/mongoData/log/r1.log --replSet rs1/127.0.0.1:28010,127.0.0.1:28012 --maxConns 800 --fork --logappend
```

```
./mongo --port 28010
```

```
> config={_id : 'rs1',members : [{_id : 0, host : 'localhost:28010'},{_id : 1, host : 'localhost:28011'},{_id : 2, host : 'localhost:28012'}]}
```

```
> rs.initiate(config)
```
##### 2.安装 ElasticSearch
```
apt-get install software-properties-common
```

```
add-apt-repository ppa:webupd8team/java
```
```
sudo apt-get install oracle-java7-installer
```

```
wget -O - http://packages.elasticsearch.org/GPG-KEY-elasticsearch | apt-key add -
```

```
$ sudo echo "deb http://packages.elasticsearch.org/elasticsearch/1.1/debian stable main" >> /etc/apt/sources.list
```

```
apt-get update
```
```
apt-get install elasticsearch
```
```
update-rc.d elasticsearch defaults 95 1
```

```
/etc/init.d/elasticsearch start
```

##### 3.ES 和 mongodb 同步
```
pip install mongo-connector

```

```
pip install elastic_doc_manager
```

```
mongo-connector -m 127.0.0.1:28010 -t 127.0.0.1:9200 -d elastic_doc_manager
```

当出现
```
Logging to mongo-connector.log.
```

OK,成功!

### 说明
1. 后台数据有两种格式输出:HTML&json , 由请求字段```submit ```的值来区分
2. Elasticsearch 的数据的 mapping 见 mapping.json



#####```submit=Json```时,返回 json 格式数据

### 历史主要更新记录

####1.访问超时
访问超时,定位瓶颈于 es 搜索时的 from 参数,当 from 参数过大,会消耗大量时间去读取数据
解决方案:
页数限制,100页.即 from 参数的最大值为1000

####2.所有的<%= %>都没有加""

####3.同步mongodb和es的脚步，能否实现新数据覆盖旧数据呢?测试一下


### 相关
author:aude (audestick@gmail.com)
