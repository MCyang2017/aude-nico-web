var router = require('koa-router')();
var fetch = require('node-fetch');
var elasticsearch = require('elasticsearch');
var config = require('../config/config');
let es = require('../config/elasticsearch');
var moment = require('moment');
const client = es.client;

router.get('/:id', async function (ctx, next) {
  
  let params = ctx.params;
  //拿到 submit 值
  let queryBody = ctx.request.query;
  let submit = queryBody.submit;
  let requestBody;
  let nickname;
  
  let id = params.id.substring(2, 10);
  let isThreadId = params.id.substring(0, 2) == "sm" ? false : true;
  //判断是thread_id还是别的
  if (isThreadId) {
    requestBody = {
      "query": {
        "match": {
          "thread_id": params.id
        }
      }
    };
  } else {
    requestBody = {
      "query": {
        "match": {
          "_id": id
        }
      }
    };
  }
  
  let data = await
  client.search({
    index: es.index,
    type: es.type,
    body: requestBody
  });
  
  let hits = data.hits;
  
  if (hits.total === 0) {
    
    if (submit != "Json") {
      ctx.state = {
        data: ""
      };
      await
      ctx.render('404', {});
    } else {
      
      ctx.response.body = {
        data: {
          message: "数据不存在",
          statusCode: 404
        }
      };
      
    }
    
  } else {
    
    if (submit == "Json") {
      
      let responseJson = hits.hits;
      
      let respondData = {
        "total": 1,
        "results": []
      }
      
      //删除urls中所有的cookie
      if (hits.hits[0]._source.urls[0] && hits.hits[0]._source.urls[0].cookie) {
        delete hits.hits[0]._source.urls[0].cookie
      }
      
      if (hits.hits[0]._source.urls[1] && hits.hits[0]._source.urls[1].cookie) {
        delete hits.hits[0]._source.urls[1].cookie
      }
      
      if (hits.hits[0]._source.urls[2] && hits.hits[0]._source.urls[2].cookie) {
        delete hits.hits[0]._source.urls[2].cookie
      }
      
      hits.hits[0]._source._id = hits.hits[0]._id;
      hits.hits[0]._source._type = hits.hits[0]._type;
      
      respondData.results.push(hits.hits[0]._source);
      
      ctx.response.body = respondData;
      
    } else {
      //转成时分秒
      let seconds = hits.hits[0]._source.length;
      let minutes = 0;
      let hours = 0;
      if (seconds > 60) {
        minutes = parseInt(seconds / 60);
        seconds = parseInt(seconds % 60);
        if (minutes > 60) {
          hours = parseInt(minutes / 60);
          minutes = parseInt(minutes % 60);
        }
      }
      let time_result = "";
      let hours_result = "";
      let minutes_result = "";
      let seconds_result = "";
      if (hours < 1) {
        hours_result = "00";
      } else if (0 < hours && hours < 10) {
        hours_result = "0" + hours;
      } else {
        hours_result = hours + "";
      }
      if (minutes < 1) {
        minutes_result = "00";
      } else if (0 < minutes && minutes < 10) {
        minutes_result = "0" + minutes;
      } else {
        minutes_result = minutes + "";
      }
      if (seconds < 1) {
        seconds_result = "00";
      } else if (0 < seconds && seconds < 10) {
        seconds_result = "0" + seconds;
      } else {
        seconds_result = seconds + "";
      }
      
      time_result = hours_result + ":" + minutes_result + ":" + seconds_result;
      hits.hits[0]._source.length = time_result;
      
      //2.文件大小（这里需要修改。。）
      if (hits.hits[0]._source.size) {
        hits.hits[0]._source.size = (hits.hits[0]._source.size / 1024 / 1024).toFixed(2) + "M";
      } else {
        hits.hits[0]._source.size = "0M";
      }
      
      if (hits.hits[0]._source.size == "0M") {
        if (hits.hits[0]._source.urls[0] && hits.hits[0]._source.urls[0].size) {
          
          hits.hits[0]._source.urls[0].size = (hits.hits[0]._source.urls[0].size / 1024 / 1024).toFixed(2) + "M";
          hits.hits[0]._source.size = hits.hits[0]._source.urls[0].size;
        } else if (hits.hits[0]._source.urls[1] && hits.hits[0]._source.urls[1].size) {
          
          hits.hits[0]._source.urls[1].size = (hits.hits[0]._source.urls[1].size / 1024 / 1024).toFixed(2) + "M";
          hits.hits[0]._source.size = hits.hits[0]._source.urls[1].size;
        } else if (hits.hits[0]._source.storage && hits.hits[0]._source.storage.local && hits.hits[0]._source.storage.local.size) {
          
          hits.hits[0]._source.storage.local.size = (hits.hits[0]._source.storage.local.size / 1024 / 1024).toFixed(2) + "M";
          hits.hits[0]._source.size = hits.hits[0]._source.storage.local.size;
        }
      }
      
      //获取时间
      let gettime = hits.hits[0]._source.get_at;
      hits.hits[0]._source.get_at = moment(gettime, "YYYYMMDD").startOf('day').fromNow();
      
      //处理URL
      if (!hits.hits[0]._source.urls[1]) {
        hits.hits[0]._source.urls[1] = {
          "value": ""
        };
      }
      
      //处理用户
      if (!hits.hits[0]._source.author || !hits.hits[0]._source.author.nickname) {
        nickname = "空";
      } else {
        nickname = hits.hits[0]._source.author.nickname;
      }
      
      ctx.state = {
        data: hits,
        nickname: nickname
      };
      
      await
      ctx.render('detail', {});
    }
  }
}
)
module.exports = router;
