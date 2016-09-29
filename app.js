const Koa = require('koa');
const app = new Koa();
const router = require('koa-router')();
const views = require('koa-views');
const co = require('co');
const convert = require('koa-convert');
const json = require('koa-json');
const onerror = require('koa-onerror');
const logger = require('koa-logger');
const index = require('./routes/index');
const test = require('./routes/test');
const watch = require('./routes/watch');

// middlewares
// app.use(convert(bodyParser));
app.use(convert(json()));
app.use(convert(logger()));
app.use(convert(require('koa-static')(__dirname + '/public')));

// app.use(views(__dirname + '/views', {
//   extension: 'jade'
// }));

app.use(views(__dirname + '/views-ejs', {
  extension: 'ejs'
}));

// logger
app.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

//处理耗时
app.use(async function(ctx , next){
  let start = new Date;
  await next();
  let ms = new Date - start;
  ctx.set('X-Response-Time' , ms + 'ms');
});

router.use('/', index.routes(), index.allowedMethods());
router.use('/test', test.routes(), test.allowedMethods());
router.use('/watch', watch.routes(), watch.allowedMethods());

app.use(router.routes(), router.allowedMethods());

app.use(async (ctx , next) => {
  try {
    await next()
    if (ctx.status === 404) {
      ctx.render('404' , {});
    }
  } catch (e) {
    ctx.status = err.status || 500
		ctx.body = err.body || err.message
		console.error(ctx.url);
		console.error(err.toString());
		console.error(err.stack+"\n");
  }
});

// response

// app.use(async function(ctx , next){
//   if (this.status == 404) {
//     await
//     ctx.render('404', {});
//   }else{
//     await next();
//   }
// });

// app.on('error',async function(err, ctx){
//   console.log(err)
//   log.error('server error', err, ctx);
//   await
//   ctx.render('404',{});
// });

module.exports = app;
