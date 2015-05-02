var request = require('request');

exports.get = function(url)
{
	var v_id = getQueryString(url).v;

	request('https://www.youtube.com/get_video_info?video_id='+v_id, function (error, response, body) {
	  if(!error && response.statusCode == 200){

	  		var v_info = parse_info(body.trim());
	  		
	  		var str_map = getFmtmap(v_info.url_encoded_fmt_stream_map),
	  			adp_map = getFmtmap(v_info.adaptive_fmts),
	  			spec_map = getSpecLink(v_info,str_map,adp_map);

	  		var title = getTitle(v_info);

	  		
	  		
	  		// get download link
	  		for (var i = 0; i<str_map.length; i++) {
	  			var link = getDownloadlink(str_map[i],title);
	  			console.log('web\n',link);
	  		}

	  		// dead link
	  		for (var i = 0; i<spec_map.length; i++) {
	  			var link = getDownloadlink(spec_map[i],title);
	  			console.log('dead\n',link);
	  		}

	  		// good
	  		for (var i = 0; i < adp_map.length; i++) {
	  			var link = getDownloadlink(adp_map[i],title);
	  			console.log('separated audio and video\n',link);
	  		}

	  		//console.log('status reason: ',v_info.reason);




	  		//console.log(v_info.dashmpd);
	  		//console.log(spec_links);
			

	  		//console.log('streamMap',str_map);
	  		//console.log('adaptMap',adp_map);

	  }
	  else console.log(error);
	});

};

/*
	get final download link
*/
function getDownloadlink(map,title){
	var url = decodeURIComponent(map.url),
		sig = (map.fmt_sig)? '&signature='+map.fmt_sig : '',
		tit = '&title='+decodeURIComponent(title);
	return url+sig+tit;
}


/* get special link */
function getSpecLink(v_info,str_map,adp_map){

	var links = [];

	if(v_info.dashmpd){

		var specurl = decodeURIComponent(v_info.dashmpd);

		// remove noise
		var q = specurl.replace(/https?:\/\/manifest.googlevideo.com\/api\/manifest\/dash\//, '');

		// prepare to format
		var sq =  q.split('/'),
			stp = [];

		// format key=value 
		for (var i = 0; i < sq.length; i+=2) {
			// if(sq[i + 1].indexOf('%')!==-1)
			// 	sq[i + 1] = decodeURIComponent(sq[i + 1]);
			
			if(sq[i]=='sig') sq[i] = "signature";
			
			if(sq[i]=='s'){
				sq[i] = "signature";
				sq[i + 1] = decodeURIComponent(sq[i + 1]);
			}
			stp.push(sq[i]+'='+sq[i + 1]);
		}

		// rebulid url
		q = stp.join('&');

		// if loss params
		if(q.toLowerCase().indexOf('ratebypass')===-1) q+='&ratebypass=yes';

		

		// get base url 
		var base_url = "";
		for (var i = 0; i < str_map.length; i++) {
			var sp_url = str_map[i].url.split('?');
			if(sp_url[0]){
				base_url = sp_url[0];
				break;
			}
		}
		// get str, adp map's  Quality params
		var str_fmt = [], adp_fmt = [];
		for (var i = 0; i < str_map.length; i++) str_fmt[str_map[i].itag] = true;
		for (var i = 0; i < adp_map.length; i++) adp_fmt[adp_map[i].itag] = true;
		
		
		// supplement new link
		if(adp_fmt[135] && str_fmt[35]=== void 0){
			links.push({
				fmt : 35,
				url : base_url+"?"+q+"&itag=35"
			});
		if((adp_fmt[137]||adp_fmt[264]) && str_fmt[37]=== void 0)
			links.push({
				fmt : 37,
				url : base_url+"?"+q+"&itag=37"
			});
		if(adp_fmt[138] && str_fmt[38]=== void 0)
			links.push({
				fmt : 38,
				url : base_url+"?"+q+"&itag=38"
			});
		}
	}
	return links;
}

/*
	video title
*/
function getTitle(v_info){
	return v_info.title?v_info.title.replace(/%22/g, ''):'ytb_video';
}

/*
	video info 
	{url_encoded_fmt_stream_map:"...."}
	return [fmt_url,fmt_sig...]
*/
function getFmtmap(fmt_info){

	var fmtmap = [];

	if(fmt_info){
		if(fmt_info.indexOf('%')!==-1) 
			fmt_info = decodeURIComponent(fmt_info);
		var dset = fmt_info.split(',');
		for (var i = 0; i < dset.length; i++){
			var sub_inf = parse_info(dset[i])
			if(sub_inf.s) sub_inf.s = re_hash(sub_inf.s);
			if(sub_inf.url) sub_inf.url = decodeURIComponent(sub_inf.url);
			if(sub_inf.itag) sub_inf.itag = parseInt(sub_inf.itag);
			fmtmap.push( sub_inf );
		}
		
	}
	return fmtmap;
}


/*
	get url query string
	http://aaa.com?a=123&b=456&c=789
	return {a:123,b:456,c:789}
*/
function getQueryString(url){
	if(url.indexOf('%')!==-1)  url = decodeURIComponent(url);
	return parse_info(url.substr(url.indexOf('?')+1,url.length-url.indexOf('?')-1));
}


/*
	parse Query String
	a=123&b=456&c=789
	return {a:123,b:456,c:789}
*/ 
function parse_info(str){
	var sq = str.split('&'),
		u = {};
	for (var i = 0; i < sq.length; i++) {
		var kv = sq[i].split('=');
		u[kv[0]] = kv[1];
	}
	return u;
}



/*
	warp index of lacation and first value (exchange)
*/
function swap(sArray, location) {
	location = location % sArray.length;
	var ref = [ sArray[location] , sArray[0] ];
	sArray[0] = ref[0];
	sArray[location] = ref[1];
	return sArray;
}


/*  get re-hash code
	s: hash code (as below)
		1. index 0 , 13 exchange
		2. remove index 0
		3. index 0 , 4 exchange
		4. remove index 0,1
		5. reverse string
		6. remove index 0,1
		7. index 0 , 25 exchange
*/
function re_hash(s) {
    var sArray = s.split(""),
    	scode = [13, -1, 4, -2, 0, -2, 25];
    for(var j = 0 ; j<scode.length; j++) 
      if (scode[j] > 0) sArray = swap(sArray, scode[j]);
      else if (scode[j] === 0) sArray = sArray.reverse();
      else sArray = sArray.slice(-scode[j]);
    return sArray.join("");
}
