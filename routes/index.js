var router = require('koa-router')();
var fetch = require('node-fetch');
var render = require('ejs');
let es = require('../config/elasticsearch');
var config = require('../config/config');
var moment = require('moment');
const client = es.client;
// const client = new elasticsearch.Client(config.elasticsearch);

function matches(query) {
  var matches = [];
  var exclude = false;
  var chars = [];
  let index;
  while(query) {
    index = query.search(/(?:"|'|\-|\+|\s)/);
    var char = index == -1 ? '' : query[index];
    if (char && !char.trim()) {
      char = ' '
    };
    var match = index == -1 ? query : query.substr(0, index);
    var query = index == -1 ? '' : query.substr(index + 1);
    if (match) {
      matches.push({
        exclude,
        match,
        exact: false,
      })
    }

    switch (char) {
      case "'":
      case "\"":
        index = query.search(char)
        if (index != -1) {
          match = query.substr(0, index).trim()
          if (match) {
            matches.push({
              exclude,
              match,
              exact: true,
            })
          }
          query = query.substr(index + 1)
        }
        exclude = false
        break
      case "-":
        exclude = chars.length == 0 || chars[chars.length - 1] == ' '
        exclude = !!exclude
        break;
      default:
        exclude = false
    }
    chars.push(char)
  }
  return matches
}

router.get('/', async function (ctx, next) {
  let data, hits;
  let queryBody = ctx.request.query;
  let title = queryBody.title;
  let category = queryBody.category;
  let tags = queryBody.tags;
  let content = queryBody.content;
  let author = queryBody.author_nickname;
  let created_at_gt = queryBody.nico_posttime_gt;
  let created_at_lt = queryBody.nico_posttime_lt;
  let length_gt = queryBody.nico_filetime_gt;
  let length_lt = queryBody.nico_filetime_lt;
  let pixels_gt = queryBody.nico_pixels_gt;
  let pixels_lt = queryBody.nico_pixels_lt;
  let size_gt = queryBody.nico_filesize_gt;
  let size_lt = queryBody.nico_filesize_lt;
  let submit = queryBody.submit;
  let sort_query = queryBody.sort;
  let page = queryBody.page;
  let limit = queryBody.limit;
  let filesize;

  let nicknameArray = [];
  let get_at_array = [];
  //queryBody非空判断
  let bool = false;

  //因为要做全数据查询,所以这里不需要非空判断了,只需要判断除开 sort 和 page 之外的字段是否都为空即可
  //这样复杂讨论的原因是 requestBody 的问题,因为没有除 sort 和 page 之外的字段,那么原来的 requestBody 则失效,需要重新构置requestBody

  //字段为空是 == "" 判断 还是 typeof == undefined?
  if (!title && !category && !tags && !content && !author && !created_at_gt && !created_at_lt
      && !length_lt && !length_gt && !pixels_lt && !pixels_gt && !size_lt && !size_gt) {
    bool = true;
  }

//queryBody 为空的情况
  if (bool) {

    let url = ctx.url;

    let requestBody = {
      "from": 0,
      "sort": []
    };


    if(limit){

      if (limit > 100) {
        limit = 100;
      } else if (limit < 1) {
        limit = 1;
      }

      requestBody.size = limit;

      if (page) {
        if(page > 100){
          page = 100;
        }
        requestBody.from = page * limit;
      }

    }else{
      if (page) {
        if(page > 100){
          page = 100;
        }
        requestBody.size = 20;
        requestBody.from = page * 20;
      }
    }

    if(!page && !limit){
      requestBody.size = 20;
    }

    let sortArray = requestBody.sort;

    if (sort_query) {
      switch (sort_query) {
        case "created_at":
          sortArray.push({
            "_score": {
              "order": "desc"
            }
          });
          break;
        case "score":

          break;
        case "pixels":
          sortArray.push({
            "pixels": {
              "order": "desc"
            }
          });
          break;
        case "get_at":
          sortArray.push({
            "get_at": {
              "order": "desc"
            }
          });
          break;
        case "view_count":
          sortArray.push({
            "view_count": {
              "order": "desc"
            }
          });
          break;
        case "comment_count":
          sortArray.push({
            "comment_count": {
              "order": "desc"
            }
          });
          break;
        case "length":
          sortArray.push({
            "length": {
              "order": "desc"
            }
          });
          break;
        default:
      }
    } else {
      sortArray.push({
        "created_at": {
          "order": "desc"
        }
      });
    }

    let data = await
    client.search({
      index: es.index,
      type: es.type,
      body: requestBody
    });

    let hits = data.hits;

    //输出 json
    if (submit == "Json") {

      let respondData = {
        "total": 0,
        "results": []
      }

      // if (page) {
      //
      // } else {
      //   //重新请求,拿到所有数据
      //   requestBody.size = 200;
      //   data = await
      //   client.search({
      //     index: es.index,
      //     type: es.type,
      //     body: requestBody
      //   });
      //   hits = data.hits;
      // }

      if(!page && !limit){
        //重新请求,拿到所有数据
        requestBody.size = 200;
        data = await
        client.search({
          index: es.index,
          type: es.type,
          body: requestBody
        });
        hits = data.hits;
      }

      if (hits.total === 0) {
        ctx.response.body = {
          data: {
            message: "数据不存在",
            statusCode: 404
          }
        };

      } else {

        respondData.total = hits.total;
        for(var key = 0 ; key < hits.hits.length ; key ++){
          try {
            hits.hits[key]._source._id = hits.hits[key]._id;
            hits.hits[key]._source._type = hits.hits[key]._type;
            delete hits.hits[key]._source.urls;
            respondData.results.push(hits.hits[key]._source);
          } catch (e) {
          }
        }
        ctx.response.body = respondData;
      }
    } else {

      for (var i = 0; i < hits.hits.length; i++) {
        try {
          //转成时分秒
          let seconds = hits.hits[i]._source.length;
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
          hits.hits[i]._source.length = time_result;

          //2.文件大小
          //
          // hits.hits[key]._source.size = "0M";
          // if (hits.hits[key]._source.size) {
          //   hits.hits[key]._source.size = (hits.hits[key]._source.size / 1024 / 1024).toFixed(2) + "M";
          //
          // } else if (hits.hits[key]._source.urls[0].size) {
          //   hits.hits[key]._source.urls[0].size = (hits.hits[key]._source.urls[0].size/1024/1024).toFixed(2)+"M";
          //   hits.hits[key]._source.size  = hits.hits[key]._source.urls[0].size;
          // }else if(hits.hits[key]._source.urls[1].size){
          //   hits.hits[key]._source.urls[1].size = (hits.hits[key]._source.urls[1].size/1024/1024).toFixed(2)+"M";
          //   hits.hits[key]._source.size  = hits.hits[key]._source.urls[1].size;
          // }else if (hits.hits[key]._source.storage.local.size) {
          //   hits.hits[key]._source.storage.local.size = (hits.hits[key]._source.storage.local.size/1024/1024).toFixed(2)+"M";
          //   hits.hits[key]._source.size  = hits.hits[key]._source.storage.local.size;
          // }else {
          //   //這些字段都特麼沒有，那麼直接給hits.hits[key]._source.size賦值是很傻的
          //   hits.hits[key]._source.size = "0M";
          // }
          //2.文件大小（这里需要修改。。）
          if (hits.hits[i]._source.size) {
            hits.hits[i]._source.size = (hits.hits[i]._source.size / 1024 / 1024).toFixed(2) + "M";
          } else {
            hits.hits[i]._source.size = "0M";
          }

          if (hits.hits[i]._source.size == "0M") {
            if (hits.hits[i]._source.urls[0].size) {
              hits.hits[i]._source.urls[0].size = (hits.hits[i]._source.urls[0].size / 1024 / 1024).toFixed(2) + "M";
              hits.hits[i]._source.size = hits.hits[i]._source.urls[0].size;
            } else if (hits.hits[i]._source.urls[1].size) {
              if (hits.hits[i]._source.urls[1]) {
                if (hits.hits[i]._source.urls[1].size) {
                  hits.hits[i]._source.urls[1].size = (hits.hits[i]._source.urls[1].size / 1024 / 1024).toFixed(2) + "M";
                  hits.hits[i]._source.size = hits.hits[i]._source.urls[1].size;
                }
              }
            } else if (hits.hits[i]._source.storage) {
              if (hits.hits[i]._source.storage.local) {
                if (hits.hits[i]._source.storage.local.size) {
                  hits.hits[i]._source.storage.local.size = (hits.hits[i]._source.storage.local.size / 1024 / 1024).toFixed(2) + "M";
                  hits.hits[i]._source.size = hits.hits[i]._source.storage.local.size;
                }
              }
            }
          }

          //获取时间
        //  let gettime = hits.hits[key]._source.get_at;
        //  hits.hits[key]._source.get_at = moment(hits.hits[key]._source.get_at, "YYYYMMDD").startOf('day').fromNow();
//获取时间


            // if((hits.hits[key]._source.get_at).toString().indexOf("201")){
            //   hits.hits[key]._source.get_at = moment(hits.hits[key]._source.get_at, "YYYYMMDD").startOf('day').fromNow();
            // }
            // hits.hits[key]._source.get_at = moment(gettime, "YYYYMMDD").startOf('day').fromNow();
            // hits.hits[key]._source.get_at = gettime.substring(0,18);

          //处理用户,判断author这个字段是否存在，可以将jsonobject转化为string，再判断string中有无author字节就可以了

          // if (!hits.hits[key]._source.author) {
          //   nicknameArray.push("空");
          // } else if (hits.hits[key]._source.author && !hits.hits[key]._source.author.nickname) {
          //   nicknameArray.push("空");
          // } else {
          //   nicknameArray.push(hits.hits[key]._source.author.nickname);
          // }

          // if (!hits.hits[i]._source.author || !hits.hits[i]._source.author.nickname) {
          //   nicknameArray.push("空");
          // } else {
          //   nicknameArray.push(hits.hits[i]._source.author.nickname);
          // }

        } catch (e) {
        }
      }

      //one more time
      for (var i = 0; i < hits.hits.length; i++) {
        if (!hits.hits[i]._source.author || !hits.hits[i]._source.author.nickname) {
          nicknameArray.push("空");
        } else {
          nicknameArray.push(hits.hits[i]._source.author.nickname);
        }
        // hits.hits[key]._source.get_at = moment(gettime, "YYYYMMDD").startOf('day').fromNow();

        // hits.hits[i]._source.get_at = moment(hits.hits[i]._source.get_at, "YYYYMMDD").startOf('day').fromNow();
        // get_at_array.push(moment(hits.hits[i]._source.get_at, "YYYYMMDD").startOf('day').fromNow());
        var time =( (hits.hits[i]._source.get_at).toString().substring(0,19)).replace(/T/g , "  ");
        get_at_array.push(time);
      }

      // for (var i = 0; i < get_at_array.length; i++) {
      //   get_at_array[i] = moment(get_at_array[i], "YYYYMMDD").startOf('day').fromNow();
      //   //问题不出在数据处理环节？在数据渲染？
      //   if (!get_at_array[i]) {
      //     get_at_array[i] = get_at_array[0]
      //   }
      // }

      ctx.state = {
        pages: hits.total > 1000 ? 1000 : hits.total-10,
        sort: sort_query,
        url: url,
        queryBody: queryBody,
        data: hits,
        currentPageNum: page,
        nicknameArray: nicknameArray,
        get_at_array:get_at_array
      };
      await
      ctx.render('index', {});
    }

  }
  else {
    //拿到 tags ,是 string ,需要转为数组
    let tags_array = new Array();
    if (tags) {
      tags_array = tags.split(",");
    }
    let requestBody = {
      "query": {
        "bool": {
          "must": [],
          "must_not":[]
        }
      },
      "from": 0,
      "sort": []
    };

    if(limit){

      if (limit > 100) {
        limit = 100;
      } else if (limit < 1) {
        limit = 1;
      }

      requestBody.size = limit;

      if (page) {
        if(page > 100){
          page = 100;
        }
        requestBody.from = page * limit;
      }

    }else{
      if (page) {
        if(page > 100){
          page = 100;
        }
        requestBody.size = 20;
        requestBody.from = page * 20;
      }
    }

    if(!page && !limit){
      requestBody.size = 20;
    }

    let spiltArray = requestBody.query.bool.must;
    let spiltArray_not = requestBody.query.bool.must_not;
    let sortArray = requestBody.sort;

//  解析

    //
    // for (var i = 0; i < title_array.length; i++) {
    //   if(title_array[i].charAt(0) == '"' && title_array[i].charAt(title_array[i].length - 1) == '"'){
    //     spiltArray.push({
    //       "multi_match": {
    //         "query": title_array[i].substring(1, title.length - 1),
    //         "type": "phrase",
    //         "analyzer": "charSplit",
    //         "fields": ["title"]
    //       }
    //     });
    //   }else if (title_array[i].charAt(0) == "-" && title_array[i].charAt(1) == '"' && title_array[i].charAt(title_array[i].length - 1)== '"') {
    //
    //     spiltArray_not.push({
    //       "multi_match": {
    //         "query": title_array[i].substring(2, title.length - 1),
    //         "type": "phrase",
    //         "analyzer": "charSplit",
    //         "fields": ["title"]
    //       }
    //     })
    //   }
    // }else if (true) {
    //
    // }
    if (title) {

    let title_array = matches(title);

    if (title_array.length > 10) {

    }

    for (var i = 0; i < title_array.length; i++) {
      //精确排除
      if (title_array[i].exact === true && title_array[i].exclude === true) {
          spiltArray_not.push({
            "multi_match": {
              "query": title_array[i].match,
              "type": "phrase",
              "analyzer": "charSplit",
              "fields": ["title"]
            }
          });
      }
      //精确查找
      else if (title_array[i].exact === true && title_array[i].exclude === false) {
          spiltArray.push({
            "multi_match": {
              "query": title_array[i].match,
              "type": "phrase",
              "analyzer": "charSplit",
              "fields": ["title"]
            }
          });
      }
      //模糊排除
      else if (title_array[i].exact === false && title_array[i].exclude === true) {
          spiltArray_not.push({
            "match": {
              "title": {
                "query": title_array[i].match,
                "operator": "and"
              }
            }
          });
      }
      //模糊查找
      else{
        spiltArray.push({
          "match": {
            "title": {
              "query": title_array[i].match,
              "operator": "and"
            }
          }
        });
      }
    }
    }

    if (content) {

    let content_array = matches(content);

    for (var i = 0; i < content_array.length; i++) {
      //精确排除
      if (content_array[i].exact === true && content_array[i].exclude === true) {
          spiltArray_not.push({
            "multi_match": {
              "query": content_array[i].match,
              "type": "phrase",
              "analyzer": "charSplit",
              "fields": ["content"]
            }
          });
      }
      //精确查找
      else if (content_array[i].exact === true && content_array[i].exclude === false) {
          spiltArray.push({
            "multi_match": {
              "query": content_array[i].match,
              "type": "phrase",
              "analyzer": "charSplit",
              "fields": ["content"]
            }
          });
      }
      //模糊排除
      else if (content_array[i].exact === false && content_array[i].exclude === true) {
          spiltArray_not.push({
            "match": {
              "content": {
                "query": content_array[i].match,
                "operator": "and"
              }
            }
          });
      }
      //模糊查找
      else{
        spiltArray.push({
          "match": {
            "content": {
              "query": content_array[i].match,
              "operator": "and"
            }
          }
        });
      }
    }
    }

    if (category) {
      spiltArray.push({
        "match": {
          "category": category
        }
      });
    }

    if (tags) {
      let tagsQueryBody = {
        "bool": {"should": []}
      };

      let tags_should_array = tagsQueryBody.bool.should;

      for (var i = 0; i < tags_array.length; i++) {
        tags_should_array.push(
            {
              "nested": {
                "path": "tags",
                "query": {
                  "match": {
                    "tags.name": tags_array[i]
                  }
                }
              }
            }
        );
      }
      spiltArray.push(tagsQueryBody);

    }
    if (author) {
      spiltArray.push({
        "nested": {
          "path": "author",
          "query": {
            "match": {
              "author.nickname": author
            }
          }
        }
      })
    }
    if (created_at_gt) {
      spiltArray.push({
        "range": {
          "created_at": {
            "gte": created_at_gt,
            "lte": created_at_lt
          }
        }
      });
    }
    if (length_gt) {
      spiltArray.push({
        "range": {
          "length": {
            "gte": length_gt,
            "lte": length_lt
          }
        }
      });
    }
    if (pixels_gt) {
      spiltArray.push({
        "range": {
          "pixels": {
            "gte": pixels_gt,
            "lte": pixels_lt
          }
        }
      });
    }
    if (size_gt) {
      spiltArray.push({
        "range": {
          "size": {
            "gte": size_gt / 1024 / 1024,
            "lte": size_lt / 1024 / 1024
          }
        }
      });
    }

    if (sort_query) {
      switch (sort_query) {
        case "created_at":
          sortArray.push({
            "created_at": {
              "order": "desc"
            }
          });
          break;
        case "score":

          break;
        case "pixels":
          sortArray.push({
            "pixels": {
              "order": "desc"
            }
          });
          break;
        case "get_at":
          sortArray.push({
            "get_at": {
              "order": "desc"
            }
          });
          break;
        case "view_count":
          sortArray.push({
            "view_count": {
              "order": "desc"
            }
          });
          break;
        case "comment_count":
          sortArray.push({
            "comment_count": {
              "order": "desc"
            }
          });
          break;
        case "length":
          sortArray.push({
            "length": {
              "order": "desc"
            }
          });
          break;
        default:
      }
    }

    // requestBody.size = 20;

    let data = await
    client.search({
      index: es.index,
      type: es.type,
      body: requestBody
    });

    let hits = data.hits;

    if (submit == "Json") {

      let respondData = {
        "total": 0,
        "results": []
      }

      if(!page && !limit){
        //重新请求,拿到所有数据
        requestBody.size = 200;
        data = await
        client.search({
          index: es.index,
          type: es.type,
          body: requestBody
        });
        hits = data.hits;
      }
      // if (page) {
      //
      // } else {
      //   //重新请求,拿到所有数据
      //   requestBody.size = 200;
      //   data = await
      //   client.search({
      //     index: es.index,
      //     type: es.type,
      //     body: requestBody
      //   });
      //   hits = data.hits;
      // }

      if (hits.total === 0) {
        ctx.response.body = {
          data: {
            message: "数据不存在",
            statusCode: 404
          }
        };
      } else {

        respondData.total = hits.total;
        for(var key = 0 ; key < hits.hits.length ; key ++){
          try {
            hits.hits[key]._source._id = hits.hits[key]._id;
            hits.hits[key]._source._type = hits.hits[key]._type;
            delete hits.hits[key]._source.urls;
            respondData.results.push(hits.hits[key]._source);
          } catch (e) {
          }
        }
        ctx.response.body = respondData;
      }
    } else {
      if (hits.total === 0) {
        await
        ctx.render('404', {});
      } else {

        //处理一下要渲染的数据
        //1.文件时间(length)
        for(var i = 0; i < hits.hits.length; i++) {
          try {
            //转成时分秒
            let seconds = hits.hits[i]._source.length;
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
            hits.hits[i]._source.length = time_result;

            //2.文件大小
            // hits.hits[key]._source.size = "0M";
            // if (hits.hits[key]._source.size) {
            //   hits.hits[key]._source.size = (hits.hits[key]._source.size / 1024 / 1024).toFixed(2) + "M";
            // } else if (hits.hits[key]._source.urls[0].size) {
            //   hits.hits[key]._source.urls[0].size = (hits.hits[key]._source.urls[0].size/1024/1024).toFixed(2)+"M";
            //   hits.hits[key]._source.size  = hits.hits[key]._source.urls[0].size;
            // }else if(hits.hits[key]._source.urls[1].size){
            //   hits.hits[key]._source.urls[1].size = (hits.hits[key]._source.urls[1].size/1024/1024).toFixed(2)+"M";
            //   hits.hits[key]._source.size  = hits.hits[key]._source.urls[1].size;
            // }else if (hits.hits[key]._source.storage.local.size) {
            //   hits.hits[key]._source.storage.local.size = (hits.hits[key]._source.storage.local.size/1024/1024).toFixed(2)+"M";
            //   hits.hits[key]._source.size  = hits.hits[key]._source.storage.local.size;
            // }else{
            //   hits.hits[key]._source.size  = "0M";
            // }

            //2.文件大小（这里需要修改。。）
            if (hits.hits[i]._source.size) {
              hits.hits[i]._source.size = (hits.hits[i]._source.size / 1024 / 1024).toFixed(2) + "M";
            } else {
              hits.hits[key]._source.size = "0M";
            }

            if (hits.hits[i]._source.size == "0M") {
              if (hits.hits[i]._source.urls[0].size) {
                hits.hits[i]._source.urls[0].size = (hits.hits[i]._source.urls[0].size / 1024 / 1024).toFixed(2) + "M";
                hits.hits[i]._source.size = hits.hits[i]._source.urls[0].size;
              } else if (hits.hits[i]._source.urls[1].size) {
                if (hits.hits[i]._source.urls[1]) {
                  if (hits.hits[i]._source.urls[1].size) {
                    hits.hits[i]._source.urls[1].size = (hits.hits[i]._source.urls[1].size / 1024 / 1024).toFixed(2) + "M";
                    hits.hits[i]._source.size = hits.hits[i]._source.urls[1].size;
                  }
                }
              } else if (hits.hits[i]._source.storage) {
                if (hits.hits[i]._source.storage.local) {
                  if (hits.hits[i]._source.storage.local.size) {
                    hits.hits[i]._source.storage.local.size = (hits.hits[i]._source.storage.local.size / 1024 / 1024).toFixed(2) + "M";
                    hits.hits[i]._source.size = hits.hits[i]._source.storage.local.size;
                  }
                }
              }
            }

            //获取时间
            //  let gettime =hits.hits[key]._source.get_at;
            // hits.hits[key]._source.get_at = moment(hits.hits[key]._source.get_at, "YYYYMMDD").startOf('day').fromNow();

            // get_at_array.push(hits.hits[i]._source.get_at);

            //获取时间
            // let gettime = (hits.hits[key]._source.get_at).toString();
            // hits.hits[key]._source.get_at = moment(gettime, "YYYYMMDD").startOf('day').fromNow();
            // hits.hits[key]._source.get_at = gettime.substring(0,18);

            //处理用户
            // if (!hits.hits[key]._source.author) {
            //   nicknameArray.push("空");
            // } else if (hits.hits[key]._source.author && !hits.hits[key]._source.author.nickname) {
            //   nicknameArray.push("空");
            // } else {
            //   nicknameArray.push(hits.hits[key]._source.author.nickname);
            // }
            //
            // if (!hits.hits[i]._source.author || !hits.hits[i]._source.author.nickname) {
            //   nicknameArray.push("空");
            // } else {
            //   nicknameArray.push(hits.hits[i]._source.author.nickname);
            // }

          } catch (e) {
          }
        }
      }

      // one more time
      for (var i = 0; i < hits.hits.length; i++) {
        if (!hits.hits[i]._source.author || !hits.hits[i]._source.author.nickname) {
          nicknameArray.push("空");
        } else {
          nicknameArray.push(hits.hits[i]._source.author.nickname);
        }

        // hits.hits[i]._source.get_at = moment(hits.hits[i]._source.get_at, "YYYYMMDD").startOf('day').fromNow();
        // get_at_array.push(moment(hits.hits[i]._source.get_at, "YYYYMMDD").startOf('day').fromNow());
        var time =( (hits.hits[i]._source.get_at).toString().substring(0,19)).replace(/T/g , "  ");
        get_at_array.push(time);
      }

      // for (var i = 0; i < get_at_array.length; i++) {
      //   get_at_array[i] = moment(get_at_array[i], "YYYYMMDD").startOf('day').fromNow();
      // }

      let url = ctx.url;

      ctx.state = {
        pages: hits.total > 1000 ? 1000 : hits.total - 10,
        sort: sort_query,
        url: url,
        queryBody: queryBody,
        data: hits,
        filesize: filesize,
        currentPageNum: page,
        nicknameArray: nicknameArray,
        get_at_array:get_at_array
      };

      await
      ctx.render('index', {});
    }
  }
}
)
module.exports = router;

