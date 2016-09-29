var elasticsearch = require('elasticsearch');
var config = require('../config/config');

const client = new elasticsearch.Client(config.elasticsearch);
module.exports = {
  client : client,
  index:"nicovideo",
  type:"posts"
}
