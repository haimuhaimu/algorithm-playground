export const TOPICS={
 cat:{name:'猫猫日常',short:'猫猫',glyph:'喵',english:'CAT LIFE',color:'#d2c5ee'},
 food:{name:'好好吃饭',short:'美食',glyph:'吃',english:'GOOD FOOD',color:'#f1b797'},
 travel:{name:'去外面走走',short:'旅行',glyph:'走',english:'OUT THERE',color:'#a6cec5'},
 tech:{name:'新鲜科技',short:'科技',glyph:'想',english:'NEW IDEAS',color:'#a9c5df'},
 sport:{name:'动起来',short:'运动',glyph:'动',english:'KEEP MOVING',color:'#efce83'},
 craft:{name:'亲手做点什么',short:'手作',glyph:'造',english:'MADE BY HAND',color:'#ddbdc9'},
};
export const INITIAL_PROFILE={cat:1,food:.78,travel:.42,tech:.35,sport:.25,craft:.18};
export const PRESETS={
 click:{name:'只追点击',weights:{click:100,diversity:0,newcomer:0}},
 balanced:{name:'多看一点',weights:{click:80,diversity:85,newcomer:15}},
 newcomer:{name:'新人上场',weights:{click:70,diversity:60,newcomer:85}},
};
const titles={
 cat:['它以为自己藏得很好','猫：这个家没我得散','一只猫和纸箱的谈判','今天也被猫拒绝了','给老猫做了一段小楼梯','我家猫的奇怪睡姿图鉴','领养第七天，它靠过来了','记录楼下三花的四季'],
 food:['这碗面让我想再来一碗','会流心的芝士烤饭','夜市里排队最长的小摊','花十分钟做一顿热饭','第一次复刻外婆的豆腐','一个人的迷你厨房日记','被低估的五种当季蔬菜','小店老板的一天从四点开始'],
 travel:['下班后，走到城市的尽头','在海边坐了整个下午','不用滤镜的山间清晨','一条没有攻略的小巷','画下我路过的公交站','周末去认识一条河','把一座城市走成一张地图','不开车的两天山野旅行'],
 tech:['我把旧键盘改成了乐器','让小机器人学会绕路','用一张图看懂推荐排序','一台老相机的新工作','自己做了个离线小工具','给植物装一个浇水提醒','算法为什么一直给我推猫','一块电路板的修复过程'],
 sport:['这次终于投进了','黄昏球场上的最后一局','跑步时听见城市醒来','新手攀岩的第一次登顶','我的十分钟拉伸记录','下班后骑一段不赶时间的路','从一公里开始的训练日记','一双旧球鞋的三年'],
 craft:['一团泥慢慢变成杯子','把废纸做成一盏灯','修好了一把摇晃的椅子','我给朋友刻了一枚小章','染出今天的天空颜色','第一次织围巾，歪得很开心','一片落叶的拓印实验','用边角料拼一只小鸟'],
};
const creators={cat:['猫薄荷电台','纸箱观察员','呼噜事务所','楼下有只猫','老猫阿福','睡姿收藏家','七日猫友','三花邻居'],food:['三餐研究所','小锅慢煮','路口那碗面','阿禾的厨房','豆腐小记','迷你厨房','当季食客','早起小店'],travel:['走到路尽头','周末出走','远山来信','随手画城市','公交站画册','沿河散步','城市脚印','山野两日'],tech:['拆开看看','像素维修站','一颗电阻','橙子做实验','离线星期六','植物邻居','算法旁听生','焊点新手'],sport:['球场边见','慢跑的豆子','今晚去攀岩','骑到日落','拉伸日记','慢骑一圈','一公里起步','旧鞋档案'],craft:['半个木匠','泥巴星期天','纸片工作室','小鹿造物','天空染坊','歪歪围巾','落叶拓本','边角小鸟']};
export const POSTS=Object.keys(TOPICS).flatMap((topic,t)=>titles[topic].map((title,i)=>({
 id:`${t}-${i}`,topic,title,creator:creators[topic][i],isNew:i>=4,
 appeal:Math.max(.3,.96-t*.025-i*.047),quality:.45+((i*3+t*2)%8)*.07,
 readTime:20+((i*7+t*11)%85),art:i,
})));
