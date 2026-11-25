/* Node Rogue v2 — story, characters, clients, studios, events, endings.
 * All names are fictional. Bilingual {en, zh}. Loaded before engine.js.
 */
(function (global) {
  'use strict';
  const loc = (en, zh) => ({ en, zh });
  const E = () => (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : global.VFXEngine;

  /* ---------------- cast (portrait params used by art.js) ---------------- */
  const CAST = {
    you:   { name: loc('You', '你'), role: loc('Junior FX artist', '初级特效师'), face: { skin: '#e8b48e', hair: '#2b1d16', style: 1, shirt: '#3a4a6b', acc: 'headset', bg: '#1d2638' } },
    mira:  { name: loc('Mira', 'Mira'), role: loc('Your old FX lead', '你以前的特效组长'), face: { skin: '#c98d68', hair: '#d8d8e0', style: 4, shirt: '#5b3b6e', acc: 'glasses', bg: '#2d2140' } },
    gus:   { name: loc('Gus', 'Gus'), role: loc('Landlord', '房东'), face: { skin: '#f0c4a0', hair: '#8a8a8a', style: 0, shirt: '#6b5232', acc: 'beard', bg: '#3a2c1c' } },
    dex:   { name: loc('Dex', 'Dex'), role: loc('Rival, ex-classmate', '同学兼对手'), face: { skin: '#a8714d', hair: '#e04848', style: 2, shirt: '#222', acc: 'earring', bg: '#3a1c22' } },
    mum:   { name: loc('Mum', '妈妈'), role: loc('Texts too often', '消息有点多'), face: { skin: '#e8b48e', hair: '#5a3a28', style: 3, shirt: '#7a3b4b', acc: null, bg: '#3a2430' } },
    pip:   { name: loc('Pip', 'Pip'), role: loc('Cat. Boss of the flat.', '猫，家里的老板'), face: { cat: true, bg: '#26304a' } },
    tess:  { name: loc('Tess Kiln', 'Tess Kiln'), role: loc('Kiln & Co · Creative Director', 'Kiln & Co · 创意总监'), face: { skin: '#f2cfb3', hair: '#e2a13b', style: 3, shirt: '#b2452c', acc: 'glasses', bg: '#3a2418' } },
    ravi:  { name: loc('Ravi Okoye', 'Ravi Okoye'), role: loc('Northlight · VFX Supervisor', 'Northlight · 特效总监'), face: { skin: '#6b4430', hair: '#111', style: 0, shirt: '#2c6b8a', acc: 'beard', bg: '#16303a' } },
    oona:  { name: loc('Oona Hale', 'Oona Hale'), role: loc('Halcyon Pictures · Head of FX', 'Halcyon Pictures · 特效主管'), face: { skin: '#e6c0a2', hair: '#1a1a2a', style: 5, shirt: '#e9d9a8', acc: 'earring', bg: '#2a2a3c' } },
    system:{ name: loc('Inbox', '收件箱'), role: loc('', ''), face: { system: true, bg: '#1a2230' } }
  };

  /* ---------------- clients ---------------- */
  const CLIENTS = {
    rumble: { persona: 'easy', name: loc('Theo Marsh', 'Theo Marsh'), company: loc('Rumble Games', 'Rumble Games'), kind: loc('Game trailer', '游戏预告片'),
      heroes: ['destr', 'fire', 'creature'], payMul: 1, face: { skin: '#d9a07a', hair: '#3b2a1a', style: 2, shirt: '#2f7a4a', acc: 'cap', bg: '#1d3324' },
      hello: loc('Hey! Big trailer energy. Make it pop and you are my favourite person.', '嘿！要那种大预告片的劲。做得够炸你就是我最喜欢的人。') },
    brightburn: { persona: 'bigger', name: loc('Dana Voss', 'Dana Voss'), company: loc('Brightburn Ads', 'Brightburn 广告'), kind: loc('TV commercial', '电视广告'),
      heroes: ['fire', 'water', 'destr'], payMul: 1.25, face: { skin: '#f0c8a8', hair: '#f2e07a', style: 3, shirt: '#e05a2a', acc: 'glasses', bg: '#3a2016' },
      hello: loc('We need IMPACT. Whatever you show me, I will want it bigger. That is my process.', '我们要冲击力。不管你给我看什么，我都会要更大。这是我的流程。') },
    fizzco: { persona: 'flipper', name: loc('Mr. Pemberton', 'Pemberton 先生'), company: loc('FizzCo Soda', 'FizzCo 汽水'), kind: loc('Soda spot', '汽水广告'), minWeek: 2,
      heroes: ['water', 'magic'], reqs: ['stylized', 'final', 'night', 'smoke'], payMul: 1.6, face: { skin: '#f4d2b8', hair: '#4a3020', style: 0, shirt: '#2aa8a8', acc: 'beard', bg: '#163a3a' },
      hello: loc('Fizzy. Bubbly. Maybe fire? We will know it when we see it. Then we will change our minds.', '要有气泡感。也许要火？看到了就知道。然后我们会改主意。') },
    vale: { persona: 'secret', name: loc('Dr. Ines Vale', 'Ines Vale 博士'), company: loc('Vale Pharmaceuticals', 'Vale 制药'), kind: loc('Pharma ad', '药品广告'), nda: true,
      heroes: ['magic', 'water'], payMul: 1.15, face: { skin: '#e9c9b0', hair: '#202030', style: 5, shirt: '#e8e8f0', acc: 'glasses', bg: '#22283a' },
      hello: loc('Everything is in the brief. Well. Almost everything. Legal will add notes later.', '要求都在 brief 里。嗯，几乎都在。法务之后会补充意见。') },
    juno: { persona: 'auteur', name: loc('Juno Park', 'Juno Park'), company: loc('Juno Park Films', 'Juno Park 电影'), kind: loc('Indie short film', '独立短片'), nda: false,
      heroes: ['creature', 'magic', 'fire'], reqs: ['night', 'grain', 'env', 'smoke'], payMul: 0.8, face: { skin: '#e2b897', hair: '#151515', style: 4, shirt: '#3a3a3a', acc: 'cap', bg: '#202020' },
      hello: loc('I can\'t pay much. But it\'s art, and it goes on your reel. It has to feel like a memory.', '我给不了多少钱。但这是艺术，可以放进你的 reel。它得像一段记忆。') },
    nightjar: { persona: 'easy', name: loc('Lux', 'Lux'), company: loc('Nightjar Records', 'Nightjar 唱片'), kind: loc('Music video', '音乐 MV'),
      heroes: ['magic', 'fire', 'water'], reqs: ['night', 'stylized', 'grain'], payMul: 0.95, face: { skin: '#9c6a4a', hair: '#b06cff', style: 2, shirt: '#151515', acc: 'earring', bg: '#2a1840' },
      hello: loc('Vibes. Neon. Midnight. You get it. You totally get it.', '氛围。霓虹。午夜。你懂的。你肯定懂。') },
    oldpine: { persona: 'pincher', name: loc('Walt Hollis', 'Walt Hollis'), company: loc('Old Pine Films', 'Old Pine 电影'), kind: loc('Documentary recreation', '纪录片情景再现'),
      heroes: ['destr', 'water', 'fire'], reqs: ['plate', 'grain', 'env'], payMul: 0.9, hoursMod: -3, face: { skin: '#f0d0b8', hair: '#e8e8e8', style: 0, shirt: '#6b7a3a', acc: 'glasses', bg: '#2a3020' },
      hello: loc('Shot it on real film. Needs to sit in the plate. Tight schedule, tighter budget.', '用真胶片拍的，要严丝合缝合进实拍。时间紧，钱更紧。') },
    gilded: { persona: 'auteur', name: loc('Celeste Amari', 'Celeste Amari'), company: loc('Gilded Crown', 'Gilded Crown 腕表'), kind: loc('Luxury watch spot', '奢侈腕表广告'), nda: true, minWeek: 5,
      heroes: ['water', 'magic', 'destr'], reqs: ['tex', 'final', 'grain'], payMul: 1.55, face: { skin: '#c48a64', hair: '#2a1a12', style: 5, shirt: '#d8b04a', acc: 'earring', bg: '#2c2414' },
      hello: loc('Perfection is the minimum. I will notice the grain. I always notice the grain.', '完美只是底线。我会注意颗粒。我永远会注意颗粒。') },
    moonbase: { persona: 'easy', name: loc('Bo Tanaka', 'Bo Tanaka'), company: loc('Moonbase Toys', 'Moonbase 玩具'), kind: loc('Kids\' show opener', '儿童节目片头'),
      heroes: ['creature', 'magic'], reqs: ['stylized', 'final'], payMul: 0.9, face: { skin: '#f2cca6', hair: '#3a78d8', style: 1, shirt: '#f0c030', acc: 'cap', bg: '#1a2a4a' },
      hello: loc('Cute! But also epic! But cute! Kids can smell fake.', '要可爱！但也要燃！但要可爱！小孩一眼就能看出假。') },
    ironvale: { persona: 'bigger', name: loc('Sgt. Rook', 'Rook 中士'), company: loc('Ironvale Interactive', 'Ironvale 互动'), kind: loc('Shooter cinematic', '射击游戏过场'), minWeek: 6,
      heroes: ['destr', 'fire'], reqs: ['smoke', 'final', 'night'], payMul: 1.3, face: { skin: '#b07a58', hair: '#202020', style: 0, shirt: '#4a5a3a', acc: 'headset', bg: '#20281c' },
      hello: loc('More debris. More smoke. When you think it\'s enough, it\'s half.', '碎片要多，烟要多。你觉得够了的时候，才一半。') }
  };

  /* ---------------- studios (tests) ---------------- */
  const STUDIOS = {
    kiln: { rep: 'tess', persona: 'studio', name: loc('Kiln & Co', 'Kiln & Co'), kind: loc('Commercial studio', '广告工作室'),
      gate: { count: 1, stars: 2 }, minStars: 4, heroChoice: true, hoursMod: 2,
      reqs: [{ id: 'lit' }, { id: 'tex' }, { id: 'final' }, { id: 'polish', n: 3 }],
      shotName: loc('Kiln Test Shot', 'Kiln 测试镜头'),
      offer: loc('Tess: “Junior FX, full-time, health insurance, Fridays off at four. Start Monday?”', 'Tess：“初级特效，全职，有医保，周五四点下班。周一来？”') },
    northlight: { rep: 'ravi', persona: 'secret', name: loc('Northlight Studios', 'Northlight 工作室'), kind: loc('Episodic TV', '剧集'),
      gate: { count: 2, stars: 3 }, minStars: 4.5, heroChoice: true, hoursMod: 3, hidden: { id: 'night' },
      reqs: [{ id: 'lit' }, { id: 'tex' }, { id: 'final' }, { id: 'grain' }, { id: 'polish', n: 3 }],
      shotName: loc('Northlight Test', 'Northlight 测试'),
      offer: loc('Ravi: “Mid-level FX on a fantasy series. Two seasons guaranteed. We\'d be lucky to have you.”', 'Ravi：“奇幻剧集的中级特效，保底两季。能请到你是我们的运气。”') },
    halcyon: { rep: 'oona', persona: 'auteur', name: loc('Halcyon Pictures', 'Halcyon Pictures'), kind: loc('Feature film · the dream', '院线电影·梦想公司'),
      gate: { count: 3, stars: 3, distinct: 2, top: 4 }, minStars: 4.5, heroChoice: true, hoursMod: 2,
      reqs: [{ id: 'lit' }, { id: 'tex' }, { id: 'final' }, { id: 'plate' }, { id: 'grain' }, { id: 'polish', n: 2 }],
      shotName: loc('The Halcyon Test', 'Halcyon 终极测试'),
      offer: loc('', '') }
  };

  /* ---------------- client notes ---------------- */
  const NOTE_LINES = {
    dead: [loc('Why is the screen full of NaNs? Is that... a choice?', '为什么满屏都是 NaN？这是……故意的？'), loc('The sim exploded. Like, actually. Fix it in comp, maybe?', '解算炸了，真炸了。要不后期修一下？')],
    nothing: [loc('I\'m looking at a black frame. Did the render even reach the output?', '我在看一帧黑画面。渲染到底有没有出到输出口？')],
    weakHero: [loc('The {el} feels weak. I need at least ★{n}.', '{el}太弱了。我至少要 ★{n}。'), loc('Push the {el}. It\'s not reading. ★{n} minimum.', '{el}再推一推，看不出来。最低 ★{n}。'), loc('Where is the drama? The {el} should be ★{n}.', '戏剧性呢？{el}得到 ★{n}。')],
    missing: [loc('It\'s missing: {req}.', '少了：{req}。'), loc('Brief says {req}. I don\'t see {req}.', 'brief 写了{req}。我没看到{req}。'), loc('Love it, but where\'s the {req}?', '喜欢，但{req}在哪？')],
    bigger: [loc('Good! Now make it BIGGER. ★{n}.', '不错！现在更大。★{n}。'), loc('It\'s nice. Nice is not a word we use here. ★{n}.', '挺好。我们这儿不用“挺好”这个词。★{n}。')],
    secret: [loc('Legal just called. It also needs: {req}. Sorry, should\'ve said.', '法务刚来电话，还要：{req}。抱歉，早该说的。'), loc('Oh, and the CEO wants {req}. Did I not mention that?', '对了，CEO 要{req}。我没提过吗？')],
    flip: [loc('Brand team pivot! It\'s a {el} spot now. Same deadline, obviously.', '品牌组改方向了！现在是{el}广告。截止日期当然不变。'), loc('We tested it with focus groups. They want {el}. Only {el}.', '焦点小组测过了，他们要{el}。只要{el}。')],
    flipStuck: [loc('Brand team wants a pivot. Nothing in your kit can carry it, so we stay on {el}. Just make it feel expensive.', '品牌组想换方向。但你手里的东西撑不起新方案，所以还是{el}。就让它看起来贵一点。'), loc('We asked for a pivot and your toolkit said no. Fine — keep the {el}, but polish it like you mean it.', '我们想改方向，你的工具箱说不行。行吧——还是{el}，但给我往死里磨。')],
    easy: [loc('This is already good, and I\'m in a good mood. Deliver this week and I\'ll add 20% to the invoice.', '这已经很好了，而且我心情不错。这周交付，我在账单上多加 20%。'), loc('Honestly? I trust you. Ship it this week and the budget grows by 20%.', '说实话？我信你。这周交上来，预算加 20%。')],
    easyLost: [loc('Ah — you kept working? The 20% was for this week\'s delivery. It\'s off the table now.', '啊——你还在改？那 20% 是给这周交付的。现在没了。')],
    pincher: [loc('Budget meeting this morning. I can protect the hours or the fee — not both. Your call.', '今早开了预算会。我能保住工时，或者保住报酬——不能都保。你选。'), loc('The producer cut something. You pick which: my hours or your money.', '制片砍了一刀。你选砍哪个：我的工时，还是你的钱。')],
    pincherHours: loc('Accept: remaining hours −10%', '接受：剩余工时 −10%'),
    pincherPay: loc('Accept: pay ×0.8, hours unchanged', '接受：报酬 ×0.8，工时不变'),
    auteur: [loc('Technically fine. Emotionally? Polish it. More.', '技术上没问题。情绪上？再打磨。更多。'), loc('I can see the pixels thinking. Polish harder.', '我能看见像素在思考。再磨。'), loc('More polish — and I want the {el} at ★{n}. Both.', '再磨——而且{el}要到 ★{n}。两个都要。')],
    auteurTest: [loc('Technically fine. I could ask for more polish. I am choosing not to. Today.', '技术上没问题。我本可以要求更多打磨。今天我选择不。'), loc('No new requirements on the test. Just make it feel expensive.', '测试不新增要求。只要让它看起来贵。')],
    love: [loc('...I just got chills. Don\'t touch anything.', '……我起鸡皮疙瘩了。什么都别动。'), loc('THIS. This is the one. Send it.', '就是这个。就这个。发过来。')],
    ok: [loc('Works for me. Deliver when you\'re happy.', '我这边可以。你满意了就交。'), loc('Solid. Any extra polish is a bonus.', '扎实。再打磨就是加分。'), loc('Approved. Unless you want to make it sing?', '通过。除非你想让它更出彩？')]
  };

  /* ---------------- inbox: scripted weeks ---------------- */
  const msg = (id, from, subject, body, choices) => ({ id, from, subject, body, choices: choices || null, resolved: null });

  function scripted(g) {
    const w = g.week;
    const out = [];
    const E_ = E();
    if (w === 1) {
      out.push(msg('w1_mira', 'mira', loc('heard about Lumen Forge', '听说了 Lumen Forge 的事'),
        loc('They closed the doors on a Tuesday. No warning. I\'m so sorry.\n\nListen: Theo at Rumble Games owes me a favour. Small shot, honest money. Wire a source into a solver, light it, ship it. Empty cells carry the stream — think of them as wires.\n\nYou have about three months of savings. Make them count. — M',
            '他们周二直接关门，一点预兆都没有。真的很抱歉。\n\n听着：Rumble Games 的 Theo 欠我个人情。小镜头，钱实在。把源接进解算器，打光，交货。空格子会把数据流传下去——当成导线就行。\n\n你的存款大概够三个月。好好用。——M')));
      out.push(msg('w1_gus', 'gus', loc('Re: rent', '回复：房租'),
        loc('Rent is due every Sunday: ${rent} including Pip\'s food. I like you, kid. I like rent more.', '每周日交房租：${rent}，含 Pip 的猫粮。我喜欢你，孩子。但我更喜欢房租。')));
      out.push(msg('w1_pip', 'pip', loc('meow', '喵'), loc('Pip has claimed the warm spot behind your monitor. Pip believes in you. Pip would also like dinner.', 'Pip 占领了显示器后面那块暖和的地方。Pip 相信你。Pip 也想吃晚饭了。')));
    }
    if (w === 2) {
      out.push(msg('w2_dex', 'dex', loc('guess who got hired', '猜猜谁被录用了'),
        loc('Northlight! Mid-level! You\'ll get there too. Probably. Their test opens in week 8 — two ★3 shots on the reel minimum. Not that you asked.',
            'Northlight！中级！你也会进去的。大概吧。他们第 8 周开放测试——reel 里至少两个 ★3 镜头。我可没主动说哦。')));
      out.push(msg('w2_mum', 'mum', loc('Did you eat?', '吃饭了吗？'),
        loc('Your aunt says freelancers die young. I said not mine. Call me?', '你小姨说自由职业的人都短命。我说我家孩子不会。给我打个电话？'),
        [
          { label: loc('Call her (−2h this week)', '打给她（本周 −2 小时）'), effect: gg => { gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 2; gg.cash += 120; return { text: loc('An hour of questions, then: “I sent you a little something for groceries.” +$120.', '一个小时的盘问，然后：“给你转了点买菜钱。”+$120。') }; } },
          { label: loc('Text “busy, love you”', '回“在忙，爱你”'), effect: () => ({ text: loc('Three heart emojis and a photo of soup. You feel slightly worse.', '三个爱心表情和一张汤的照片。你心里有点愧疚。') }) }
        ]));
    }
    if (w === 3) {
      out.push(msg('w3_mira', 'mira', loc('a trick from the old days', '老前辈的小技巧'),
        loc('Dailies are free feedback. Cook once early, read the notes, then fix. Nodes you don\'t touch stay cached — zero hours. A clean network is a fast network.\n\nAnd when a solver starts screaming? Cache it. Greed kills sims.',
            'Dailies 是免费的意见。早点 Cook 一次，看 note，再改。没动过的节点会保留缓存——零耗时。网络越干净，速度越快。\n\n解算器开始尖叫的时候？赶紧缓存。贪心会害死解算。')));
      out.push(msg('w3_pip', 'pip', loc('CRASH', '哐当'),
        loc('Pip knocked a full mug of coffee onto your keyboard. Pip does not apologise.', 'Pip 把一整杯咖啡碰翻在键盘上。Pip 不道歉。'),
        [
          { label: loc('New keyboard ($60)', '买新键盘（$60）'), cost: 60, effect: gg => { gg.cash -= 60; return { text: loc('Clicky. Expensive. Worth it.', '咔哒咔哒。很贵。值。') }; } },
          { label: loc('Dry it in rice (−3h next job)', '泡米里晾干（下个活 −3 小时）'), effect: gg => { gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 3; return { text: loc('The spacebar sticks now. You will learn to live with it.', '空格键现在会卡。你会习惯的。') }; } }
        ]));
    }
    if (w === 4) {
      out.push(msg('w4_tess', 'tess', loc('Kiln & Co open test', 'Kiln & Co 公开测试'),
        loc('We\'re hiring one junior FX artist. Open test this week only. Reel requirement: at least one shot at ★2 or better (no NDA work — we can\'t see it).\n\nPick your own hero element. Show us taste.',
            '我们招一名初级特效师，公开测试仅限本周。Reel 门槛：至少一个 ★2 及以上镜头（签了 NDA 的不算——我们看不到）。\n\n主角元素你自己选。让我们看看你的品味。')));
    }
    if (w === 5) {
      out.push(msg('w5_gus', 'gus', loc('the boiler', '锅炉'),
        loc('Boiler\'s broken. Space heater in the hall if you need it. Your computer probably heats the flat anyway.', '锅炉坏了。冷的话走廊有个电暖器。不过你那台电脑大概能把整个屋子烤热。')));
    }
    if (w === 6) {
      const has = g.relics.includes('notebook');
      out.push(msg('w6_mira', 'mira', loc('some news', '一个消息'),
        has ? loc('I\'m leaving the industry. Opening a bakery, of all things. You already have my notebook — use it. Bread doesn\'t diverge. — M',
                  '我要离开这行了。居然是去开面包店。你已经有我的笔记本了——用起来。面包不会发散。——M')
            : loc('I\'m leaving the industry. Opening a bakery, of all things. I mailed you my old notebook: twenty years of dailies notes. One more round of feedback per job, on me. Bread doesn\'t diverge. — M',
                  '我要离开这行了。居然是去开面包店。我把旧笔记本寄给你了：二十年的 dailies 笔记。每个活多一轮意见，算我的。面包不会发散。——M'),
        [{ label: loc('Open the package', '拆开包裹'), effect: gg => { if (!gg.relics.includes('notebook')) gg.relics.push('notebook'); else gg.cash += 150; return { text: has ? loc('A loaf of sourdough and $150 tucked inside. Of course.', '一条酸面包，里面夹着 $150。果然。') : loc('Relic gained: Mira\'s Notebook (+1 dailies).', '获得遗物：Mira 的笔记本（+1 次 dailies）。') }; } }]));
      out.push(msg('w6_gus', 'gus', loc('rent increase', '房租上涨'),
        loc('Property tax went up. So rent goes up $60 from now on. I hate it too.', '房产税涨了，所以从现在起房租涨 $60。我也很讨厌。'),
        [{ label: loc('Sigh', '叹气'), effect: gg => { gg.flags.rentHike = true; return { text: loc('Weekly rent is now ${rent}.', '每周房租现在是 ${rent}。') }; } }]));
    }
    if (w === 7) {
      out.push(msg('w7_dex', 'dex', loc('quick q', '问个问题'),
        loc('How do you keep FLIP from exploding? Asking for a friend. The friend is me. Ravi is watching.', '你怎么让 FLIP 不炸的？替朋友问的。朋友就是我。Ravi 在盯着我。'),
        [
          { label: loc('Send him your collision setup', '把你的碰撞体设置发给他'), effect: gg => { gg.flags.helpedDex = true; return { text: loc('“...you\'re a lifesaver. I owe you.” He means it.', '“……你救了我。欠你一个。”他是认真的。') }; } },
          { label: loc('“Read the docs, Dex.”', '“去看文档，Dex。”'), effect: () => ({ text: loc('Petty. Satisfying. A little lonely.', '小气。爽。有点孤单。') }) }
        ]));
    }
    if (w === 8) {
      out.push(msg('w8_ravi', 'ravi', loc('Northlight test', 'Northlight 测试'),
        loc('Our test is open. Reel: two shots at ★3+, no NDA work. The brief has a requirement we\'ll reveal after your first dailies — that\'s how real shows work.',
            '我们的测试开放了。Reel：两个 ★3+ 镜头，NDA 的不算。brief 里有一条要求会在你第一次 dailies 之后才公布——真实的剧组就是这样。')));
    }
    if (w === 9) {
      out.push(msg('w9_pip', 'pip', loc('Pip isn\'t eating', 'Pip 不吃东西了'),
        loc('Pip hasn\'t touched breakfast and is hiding under the bed. The vet can see her today.', 'Pip 早饭一口没动，躲在床底下。兽医今天可以看。'),
        [
          { label: loc('Vet, now ($240)', '马上去看兽医（$240）'), cost: 240, effect: gg => { gg.cash -= 240; if (!gg.relics.includes('pip')) gg.relics.push('pip'); return { text: loc('A swallowed hair tie. She\'s fine. She now refuses to leave your desk. Relic gained: Pip on the Desk.', '吞了根发圈，没事了。她现在死活不离开你的桌子。获得遗物：桌上的 Pip。') }; } },
          { label: loc('Wait and watch (−4h)', '先观察（−4 小时）'), effect: gg => { gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 4; return { text: loc('You barely work. By evening she eats a little. You both sleep on the floor.', '你几乎没干活。到晚上她吃了一点。你们俩一起睡在地板上。') }; } }
        ]));
    }
    if (w === 10) {
      out.push(msg('w10_dex', 'dex', loc('so, um', '那个，嗯'),
        loc('Northlight lost the show. Whole team, gone. Can I crash on your couch for a bit? I\'ll chip in what I can.',
            'Northlight 丢了那个剧。整个组都没了。我能在你沙发上借住一阵吗？我能出多少出多少。'),
        [
          { label: loc('“Couch is yours.”', '“沙发归你了。”'), effect: gg => { gg.cash += 150; gg.flags.dexRoommate = true; return { text: loc('He brings a bag, a monitor, and $150. Pip hates him. Then loves him.', '他带来一个包、一台显示器和 $150。Pip 先是讨厌他，后来爱上了他。') }; } },
          { label: loc('“Sorry, it\'s tight.”', '“抱歉，挤不下。”'), effect: () => ({ text: loc('“Yeah. Totally. Good luck at Halcyon.” Typing… stopped.', '“嗯，懂的。Halcyon 加油。”正在输入……停了。') }) }
        ]));
    }
    if (w === 11) {
      out.push(msg('w11_oona', 'oona', loc('Halcyon Pictures — final test', 'Halcyon Pictures——终极测试'),
        loc('Next week we open one seat on the FX team. Reel requirements:\n• three shots at ★3+\n• at least two different hero elements\n• one shot at ★4+\nNo NDA work. The test shot must sit in a live-action plate. We will not lower the bar.',
            '下周我们特效组开放一个名额。Reel 要求：\n• 三个 ★3+ 镜头\n• 至少两种不同主角元素\n• 一个 ★4+ 镜头\nNDA 作品不算。测试镜头必须合进实拍。我们不会降低标准。')));
      out.push(msg('w11_mira', 'mira', loc('photo attached', '附图'), loc('[a photo of a very uneven croissant] First batch. Bring your reel when you visit. — M', '[一张歪歪扭扭的可颂照片] 第一炉。来看我的时候带上你的 reel。——M')));
    }
    if (w === 12) {
      const lines = g.flags.dexRoommate
        ? loc('Dex made you breakfast. Mum sent eleven texts. Mira sent bread. Pip is on the keyboard. This is it.', 'Dex 给你做了早饭。妈妈发了十一条消息。Mira 寄来了面包。Pip 坐在键盘上。就是今天了。')
        : loc('Mum sent eleven texts. Mira sent bread. Pip is on the keyboard. This is it.', '妈妈发了十一条消息。Mira 寄来了面包。Pip 坐在键盘上。就是今天了。');
      out.push(msg('w12_all', 'system', loc('Week 12', '第 12 周'), lines));
      if (g.flags.dexRoommate || g.flags.helpedDex) {
        out.push(msg('w12_dex', 'dex', loc('one more thing', '还有一件事'), loc('I rented you farm time on my old account. +4h, no charge. Go get it.', '我用旧账号给你租了农场时间。+4 小时，免费。去拿下它。'),
          [{ label: loc('Thanks, Dex', '谢了，Dex'), effect: gg => { gg.bonusHoursNext += 4; return { text: loc('+4h on this week\'s job.', '本周的活 +4 小时。') }; } }]));
      }
    }
    return out;
  }

  /* ---------------- random events ---------------- */
  const EVENTS = [
    { id: 'outage', w: 1, make: g => msg('ev_outage', 'system', loc('Power cut', '停电'), loc('The whole block lost power for an afternoon.', '整栋楼停电一下午。'),
      [{ label: loc('Light a candle (−3h)', '点根蜡烛（−3 小时）'), effect: gg => { gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 3; return { text: loc('You sketch node graphs on paper. Surprisingly useful.', '你在纸上画节点图。意外地有用。') }; } }]) },
    { id: 'drive', w: 1, make: g => msg('ev_drive', 'system', loc('Disk failure', '硬盘故障'), loc('Your project drive is clicking. That\'s never good.', '项目硬盘在咔咔响。这从来不是好事。'),
      [{ label: loc('Pray', '祈祷'), effect: gg => {
        if (gg.relics.includes('backup')) return { text: loc('Backup Drive saved everything. Smug.', '备份硬盘救了一切。得意。') };
        gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 4;
        const basic = ['box', 'light', 'comp', 'merge', 'plate', 'shader'];
        const pool = gg.cards.filter(c => !basic.includes(c.type) && E().cardHasQuality(c));
        if (!pool.length) return { text: loc('You spend 4 hours relinking old files. Nothing important was lost.', '你花了 4 小时重新链接旧文件。没丢什么重要的。') };
        const c = pool[Math.floor(gg.rng() * pool.length)];
        const before = c.q || 1;
        c.q = Math.max(1, before - 1);
        const name = E().NODE_DEFS[c.type].name;
        return { text: { en: 'You spend 4h this week relinking files. ' + name.en + ' drops a quality tier (Q' + before + ' → Q' + c.q + ').', zh: '本周花 4 小时重新链接文件。' + name.zh + ' 的质量档降 1（Q' + before + ' → Q' + c.q + '）。' } };
      } }]) },
    { id: 'plugin', w: 1, make: g => msg('ev_plugin', 'system', loc('A gift from the forum', '论坛送的礼物'), loc('Someone you helped two years ago sent you a licence key.', '两年前你帮过的一个人寄来一个授权码。'),
      [{ label: loc('Redeem', '兑换'), effect: gg => {
        const pool = ['guru', 'lut', 'wedge', 'hotkeys', 'lookdev', 'farm'].filter(r => !gg.relics.includes(r));
        if (!pool.length) { gg.cash += 200; return { text: loc('You already own everything. Sold the key: +$200.', '你全都有了。把授权码卖了：+$200。') }; }
        const r = pool[Math.floor(gg.rng() * pool.length)]; gg.relics.push(r);
        return { text: { en: 'Relic gained: ' + E().RELICS[r].name.en, zh: '获得遗物：' + E().RELICS[r].name.zh } };
      } }]) },
    { id: 'binge', w: 1, make: g => msg('ev_binge', 'system', loc('3 a.m. tutorial binge', '凌晨三点狂刷教程'), loc('You couldn\'t sleep, so you watched nine hours of tutorials.', '睡不着，你看了九个小时教程。'),
      [{ label: loc('Learn something', '学点东西'), effect: gg => {
        const ids = E().NODE_IDS.filter(id => !['box', 'plate'].includes(id));
        const id = ids[Math.floor(gg.rng() * ids.length)]; gg.cards.push(E().makeCard(id));
        return { text: { en: 'New node: ' + E().NODE_DEFS[id].name.en, zh: '新节点：' + E().NODE_DEFS[id].name.zh } };
      } }]) },
    { id: 'tax', w: 1, make: g => msg('ev_tax', 'system', loc('Tax refund', '退税'), loc('The tax office made a mistake. In your favour, for once.', '税务局算错了。难得一次对你有利。'),
      [{ label: loc('Accept, quickly', '赶紧收下'), effect: gg => { gg.cash += 150; return { text: loc('+$150', '+$150') }; } }]) },
    { id: 'latepay', w: 1, minWeek: 3, make: g => msg('ev_late', 'system', loc('Invoice overdue', '尾款逾期'), loc('A past client “lost” your invoice. Chase it?', '一个老客户把你的发票“弄丢了”。要不要追？'),
      [
        { label: loc('Chase (−2h, +$120)', '去追（−2 小时，+$120）'), effect: gg => { gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 2; gg.cash += 120; return { text: loc('Four emails, two calls. Paid.', '四封邮件，两通电话。到账了。') }; } },
        { label: loc('Let it go', '算了'), effect: () => ({ text: loc('You let it go. It does not let you go.', '你放下了。它没放过你。') }) }
      ]) },
    { id: 'fan', w: 1, minWeek: 2, make: g => msg('ev_fan', 'system', loc('GPU fan rattling', 'GPU 风扇在响'), loc('Your GPU fan sounds like a lawnmower.', '你的显卡风扇听起来像割草机。'),
      [
        { label: loc('Replace it ($90)', '换掉（$90）'), cost: 90, effect: gg => { gg.cash -= 90; return { text: loc('Silence. Beautiful silence.', '安静了。美妙的安静。') }; } },
        { label: loc('Ignore it (−3h)', '不管它（−3 小时）'), effect: gg => { if (gg.relics.includes('backup')) return { text: loc('It sorts itself out.', '它自己好了。') }; gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 3; return { text: loc('Thermal throttling all week.', '一整周都在降频。') }; } }
      ]) },
    { id: 'festival', w: 1, minWeek: 4, make: g => msg('ev_fest', 'system', loc('Short-film festival', '短片节'), loc('A tiny festival wants a shot from your reel for their opening titles.', '一个小影展想用你 reel 里的一个镜头当开场。'),
      [{ label: loc('Send one', '发一个'), effect: gg => { const ok = gg.reel.some(s => !s.nda && !s.ng); if (ok) { gg.cash += 200; return { text: loc('They loved it. Prize money: +$200.', '他们很喜欢。奖金 +$200。') }; } return { text: loc('Your reel is empty. Next year.', '你的 reel 还是空的。明年吧。') }; } }]) },
    { id: 'catvid', w: 1, make: g => msg('ev_cat', 'pip', loc('Pip went viral', 'Pip 火了'), loc('You posted Pip sitting on a render progress bar. 400k views.', '你发了 Pip 坐在渲染进度条上的视频。40 万播放。'),
      [{ label: loc('Monetise the cat', '让猫变现'), effect: gg => { gg.cash += 80; return { text: loc('+$80. Pip demands a cut.', '+$80。Pip 要求分成。') }; } }]) },
    { id: 'farmsale', w: 1, make: g => msg('ev_farm', 'system', loc('Farm promo code', '农场优惠码'), loc('A render farm is giving away free hours to win customers.', '一家渲染农场在送免费时长拉客户。'),
      [{ label: loc('Claim (+3h next job)', '领取（下个活 +3 小时）'), effect: gg => { gg.bonusHoursNext += 3; return { text: loc('+3h on your next job.', '下个活 +3 小时。') }; } }]) },
    { id: 'meetup', w: 1, minWeek: 2, make: g => msg('ev_meetup', 'system', loc('Houdini meetup', 'Houdini 线下聚会'), loc('Free pizza and a talk on solver stability. Tonight.', '有免费披萨，还有一场讲解算稳定性的分享。就今晚。'),
      [
        { label: loc('Go (−2h, learn Collision)', '去（−2 小时，学会碰撞体）'), effect: gg => { gg.flags.hoursPenalty = (gg.flags.hoursPenalty || 0) - 2; gg.cards.push(E().makeCard('collision')); return { text: loc('New node: Collision. And three slices of pizza.', '新节点：碰撞体。外加三块披萨。') }; } },
        { label: loc('Stay home', '待在家'), effect: () => ({ text: loc('Pip approves.', 'Pip 表示赞同。') }) }
      ]) },
    { id: 'sale', w: 1, minWeek: 3, make: g => msg('ev_sale', 'system', loc('Used hardware', '二手硬件'), loc('A studio that shut down is selling RAM sticks cheap.', '一家倒闭的工作室在低价卖内存条。'),
      [
        { label: loc('Buy 12 GB ($120)', '买 12 GB（$120）'), cost: 120, effect: gg => { if (gg.hw.ram >= E().CONFIG.maxRam) { return { text: loc('Your board is full. Refunded.', '主板插满了，退款。') }; } gg.cash -= 120; gg.hw.ram += E().CONFIG.ramStep; return { text: loc('RAM +12 GB.', '内存 +12 GB。') }; } },
        { label: loc('Pass', '算了'), effect: () => ({ text: loc('Someone else got a bargain.', '别人捡了便宜。') }) }
      ]) }
  ];

  function inboxFor(g, rng) {
    const out = scripted(g);
    if (g.week >= 2 && g.week <= 11 && rng() < 0.75) {
      const pool = EVENTS.filter(e => (!e.minWeek || e.minWeek <= g.week) && !(g.flags.seenEvents || []).includes(e.id));
      if (pool.length) {
        const e = pool[Math.floor(rng() * pool.length)];
        g.flags.seenEvents = (g.flags.seenEvents || []).concat([e.id]);
        out.push(e.make(g));
      }
    }
    return out;
  }

  /* ---------------- endings ---------------- */
  const ENDINGS = {
    evicted: { tone: 'bad', title: loc('EVICTED', '被赶出门'),
      body: loc('Sunday came and the account came up short. Gus changed the locks with an apology he clearly practised.\n\nYou carried the tower PC down four flights of stairs. Pip rode on top of it like a queen.\n\nThe reel is still on your drive. It is not over. It is just, for now, over.',
                '周日到了，账户余额不够。Gus 换了锁，道歉的话显然练习过。\n\n你把主机扛下四层楼。Pip 像女王一样坐在上面。\n\nReel 还在你硬盘里。没有结束。只是，暂时结束了。') },
    offer_kiln: { tone: 'mid', title: loc('SAFE HARBOR', '安稳港湾'),
      body: loc('You said yes to Kiln & Co. Soda bubbles, car commercials, a desk by the window.\n\nIt is not Halcyon. But on Fridays you leave at four, and on Saturdays you visit a bakery that sells uneven croissants.\n\nPip got a new bed. It is the box the bed came in.',
                '你答应了 Kiln & Co。汽水泡泡、汽车广告、一张靠窗的桌子。\n\n不是 Halcyon。但每周五四点你就能下班，周六你会去一家卖歪可颂的面包店。\n\nPip 有了新床。准确地说是新床的包装箱。') },
    offer_northlight: { tone: 'mid', title: loc('TWO SEASONS', '两季合约'),
      body: loc('You took the Northlight seat. Dragons on Tuesdays, storms on Thursdays.\n\nSometimes you open Halcyon\'s careers page and close it again. That\'s fine. You are good at this, and people know your name now.\n\nGus lowered the rent. He says it\'s because you never complained. It\'s because you paid early.',
                '你接下了 Northlight 的位置。周二做龙，周四做风暴。\n\n有时你会打开 Halcyon 的招聘页，然后又关上。没关系。你很擅长这个，大家也知道你的名字了。\n\nGus 降了房租。他说因为你从不抱怨。其实是因为你总是提前交。') },
    freelance: { tone: 'mid', title: loc('STILL FREELANCE', '依然自由'),
      body: loc('Twelve weeks. The rent got paid. Halcyon said no — for now.\n\nBut the reel is longer than it was. The clients call back. Juno wants you on her feature.\n\nYou are not starving. You are building. Next year, the bar will be the same height — and you won\'t be.',
                '十二周。房租都交上了。Halcyon 说了不——暂时。\n\n但 reel 比以前长了。客户会回头找你。Juno 想让你做她的长片。\n\n你没有饿死。你在积累。明年门槛还是那么高——但你不会还是现在的你。') },
    dream: { tone: 'good', title: loc('HALCYON', 'HALCYON'),
      body: loc('Oona watched the test twice without speaking. Then: “Monday. Bring the cat if you have to.”\n\nYou walk past the lobby poster of the film you\'ll be working on and don\'t quite believe it.\n\nMira\'s bakery sends a cake shaped like a node graph. Mum tells the whole family. Dex helps you carry the PC — down four flights, one last time.\n\nRoll the reel.',
                'Oona 一言不发看了两遍测试镜头。然后说：“周一来。非要的话，带上猫。”\n\n你走过大厅里那部你即将参与的电影海报，还是不太敢相信。\n\nMira 的面包店送来一个节点图形状的蛋糕。妈妈告诉了全家。Dex 帮你把主机扛下四楼——最后一次。\n\n播放 reel。') }
  };

  const STORY = { CAST, CLIENTS, STUDIOS, NOTE_LINES, EVENTS, ENDINGS, inboxFor, scripted };
  if (typeof module !== 'undefined' && module.exports) module.exports = STORY;
  global.VFXStory = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
