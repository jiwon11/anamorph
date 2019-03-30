const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { Page,Hashtag,User } = require('../../models');
const { isLoggedIn } = require('./middlewares');

const router = express.Router();
fs.readdir('uploads', (error)=> {
    if(error) {
        console.error('uploads 폴더가 없어 폴더를 생성합니다.');
        fs.mkdirSync('uploads');
    }
});

const upload = multer({
    storage : multer.diskStorage({
        destination(req, file, cb) {
            cb(null,'uploads/');
        },
        filename(req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, path.basename(file.originalname, ext) + new Date().valueOf() + ext);
        },
    }),
    limits : { fileSize : 5 * 1024 * 1024 },
});
router.post('/img',isLoggedIn, upload.single('img'), (req,res) => {
    console.log(req.file);
    res.json({ url : `/img/${req.file.filename}`});
});

const upload2 = multer();
router.post('/post', isLoggedIn, upload2.none(), async (req, res, next) => {
    try {
        console.log(req.body);
        const page = await Page.create({
            title : req.body.title,
            content : req.body.content,
            img : req.body.url,
            userId : req.user.id,
            //이 부분에 추후 페이지 메타데이터 추가
        });
        const Hashtags = req.body.tags;
        const splitHashtags = Hashtags.split(',');
        console.log(splitHashtags);
        if (splitHashtags) {
            const result = await Promise.all(splitHashtags.map(tag => Hashtag.findOrCreate({
                where : { title : tag.toLowerCase() },
            })));
            await page.addHashtags(result.map(r => r[0]));
        }
        res.redirect('/pages');
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/', (req, res, next) => {
    Page.findAll({
        include : {
            model : User,
            attributes : ['id', 'username'],
        },
        order : [['createdAt','DESC']],
    })
    .then (async (pages) => {
            const tags = await Hashtag.findAll({ });
            res.render('index', {
                title : 'Anamorph',
                pages : pages,
                user : req.user,
                tags : tags,
                loginError : req.flash('loginError'),
            });
    })
    .catch((error) => {
        console.error(error);
        next(error);
    });
});


router.get('/:pageId', async (req, res, next) => {
    const pageId = req.params.pageId;
    if(!pageId) {
        return res.redirect('/');
    }
    try{
    const page = await Page.find({ 
        where : { id : pageId },
        include : [{
            model : User,
            attributes : ['id', 'username'],
        }, {
            model : Hashtag,
        }
    ], 
     });
    return res.render('pageView', {
        title : `${page.title} | Anamorph`,
        user : req.user,
        page : page, 
    });
    } catch (error) {
    console.error(error);
    return next(error);
    }
});

router.post('/:id/delete', isLoggedIn, async (req, res, next) => {
    console.log(`Delete Page id : ${req.body.id}`);
    Page.destroy({ where : { id : req.body.id } })
        .then((result) => {
            res.redirect('/pages');
        })
        .catch((err) => {
            console.err(err);
            next(err);
        });
});

module.exports = router;