(window.webpackJsonp=window.webpackJsonp||[]).push([[9],{"9dZ9":function(n,t,e){"use strict";e.r(t);var r=e("jmfF"),a=e("HgYO"),o=e("pHTu"),i=e("uUnl"),s=e("Hvka");t.default=function(){var n=Object(a.c)({query:"\n      {\n        allGatsbyPage {\n          nodes {\n            path\n            pluginCreator {\n              name\n            }\n          }\n        }\n      }\n    "})[0],t=n.data,e=n.fetching,c=n.error;if(e)return Object(r.b)(o.a,null);if(c){var u=c.networkError&&c.networkError.message||Array.isArray(c.graphQLErrors)&&c.graphQLErrors.map((function(n){return n.message})).join(" | ");return Object(r.b)("p",null,"Error: ",u)}return Object(r.b)(r.a,{gap:8,flexDirection:"column",sx:{paddingY:7,paddingX:6}},Object(r.b)(r.a,{gap:6,flexDirection:"column"},Object(r.b)(i.a,{as:"h1",sx:{fontWeight:"500",fontSize:5}},"Pages"),Object(r.b)("ul",{sx:{pl:0,listStyle:"none"}},t.allGatsbyPage.nodes.filter((function(n){return 0!==n.path.indexOf("/dev-404-page/")})).sort((function(n,t){return n.path.localeCompare(t.path)})).map((function(n){return Object(r.b)("li",{key:n.path,sx:{p:0}},Object(r.b)(r.a,{flexDirection:"column",gap:3,sx:{backgroundColor:"ui.background",padding:5,borderRadius:2}},Object(r.b)(i.a,{as:"h3"},n.path),Object(r.b)(s.a,{sx:{color:"text.secondary"}},"Source: ",n.pluginCreator.name)))})))))}},Lxe0:function(n,t,e){"use strict";function r(n,t){void 0===t&&(t="warning")}e.d(t,"a",(function(){return r}))},uUnl:function(n,t,e){"use strict";e.d(t,"a",(function(){return d}));var r=e("+wNj"),a=e("l1C2"),o=e("ERkP"),i=e("aWzz"),s=e.n(i);function c(n){var t=n.children,e=n.as,a=void 0===e?"h1":e,i=Object(r.a)(n,["children","as"]);return Object(o.createElement)(a,Object.assign({},i),t)}c.propTypes={as:s.a.oneOf(["h1","h2","h3","h4","h5","h6","span"])};var u=e("Lxe0");var f=function(n){return{margin:0,lineHeight:n.lineHeights.heading}},l={DISPLAY:function(n){return{fontFamily:n.fonts.heading}},UI:function(n){return{fontFamily:n.fonts.headingUI}}},p=function(n,t){return function(e){return[{color:e.tones[t].text},"PRIMARY"===n&&{fontWeight:e.fontWeights.bold},"EMPHASIZED"===n&&{fontWeight:e.fontWeights.extraBold},"LIGHT"===n&&{fontWeight:100,textTransform:"uppercase"}]}};function d(n){var t=n.tone,e=void 0===t?"NEUTRAL":t,o=n.variant,i=void 0===o?"PRIMARY":o,s=n.fontVariant,d=void 0===s?"DISPLAY":s,b=n.as,g=void 0===b?"h2":b,h=n.customCss,m=Object(r.a)(n,["tone","variant","fontVariant","as","customCss"]);return function(n){void 0!==n&&Object(u.a)('Styling components via "customCss" prop is deprecated, please use Emotion "css" prop or pass a "className"')}(h),Object(a.c)(c,Object.assign({as:g,css:function(n){return[f(n),p(i,e)(n),l[d](n),h]}},m))}}}]);
//# sourceMappingURL=component---src-pages-pages-tsx-f865a6a00da36ea6b527.js.map