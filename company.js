import whois  from 'whois-json';
(async function(){

	var results = await whois('troopr.io');
	console.log(JSON.stringify(results, null, 2));
})()