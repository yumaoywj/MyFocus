var weiboAppKey = "82966982";

var renrenApiKey = "6c094cc7a9634012825a8fddd92dddec",
	renrenSecretKey = "09a3306b0b0e466b8e06d5bbe15a3369",
	renrenRedirectUri = "http://graph.renren.com/oauth/login_success.html",
	renrenRefreshToken,
	renrenAccessToken;



chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	if (request.key === "renrenCode") {
		$.ajax({
			url: "https://graph.renren.com/oauth/token?grant_type=authorization_code&client_id="+renrenApiKey+"&redirect_uri="+renrenRedirectUri+"&client_secret="+renrenSecretKey+"&code="+request.value,
			type: "GET",
			dataType: "json",
			success: function(data) {
				localStorage.setItem("renrenAccessToken", data.access_token);
				localStorage.setItem("renrenRefreshToken", data.refresh_token);
				window.location.reload();
			},
			error: function(data) {
				alert("RenrenOauthCode Ajax Error");
			}
		});
	}
});


if(localStorage.length === 0) {
	localStorage.setItem("notifAmount", "0");
	localStorage.setItem("targets", $.toJSON({}));
	localStorage.setItem("checkPoint", $.toJSON({}));
	localStorage.setItem("unreadStatuses", $.toJSON({}));
} else {
	var originNotif = parseInt((localStorage.getItem("notifAmount")));
	if(originNotif > 0) {	
		chrome.browserAction.setBadgeText({text: "" + originNotif});
	} else {
		chrome.browserAction.setBadgeText({text: ""});
	}

	var targets = $.evalJSON(localStorage.getItem("targets"));

	if (localStorage.getItem("renrenRefreshToken") !== null) {
		renrenRefreshToken = localStorage.getItem("renrenRefreshToken");
		$.ajax({
			url: "https://graph.renren.com/oauth/token?grant_type=refresh_token&refresh_token="+renrenRefreshToken+"&client_id="+renrenApiKey+"&client_secret="+renrenSecretKey,
			type: "GET",
			dataType: "json",
			success: function(data) {
				localStorage.setItem("renrenAccessToken", data.access_token);
				renrenAccessToken = data.access_token;
				checkAllStatusesUpdate();
			},
			error: function(data) {
				renrenAccessToken = localStorage.getItem("renrenAccessToken");
				checkAllStatusesUpdate();
				alert("RenrenOauthRefresh Ajax Error");
			}
		});
	} else {
		checkAllStatusesUpdate();
	}
}


function checkAllStatusesUpdate() {
	var checkPoint = $.evalJSON(localStorage.getItem("checkPoint"));

	for (var key in checkPoint) {
		for (var social in checkPoint[key]) {
			var apiURL;
			switch (social) {
				case "weibo":
					apiURL = "https://api.weibo.com/2/statuses/user_timeline.json?source="+weiboAppKey+"&uid="+targets[key][social]["id"]+"&trim_user=0";
					break;
				case "renren":
					apiURL = "https://api.renren.com/v2/feed/list?access_token="+renrenAccessToken+"&userId="+targets[key][social]["id"];
					break;
				case "renrenSimple":
					apiURL = "https://api.renren.com/v2/status/list?access_token="+renrenAccessToken+"&ownerId="+targets[key]["renren"]["id"];
					break;
				default:
					break;
			}
			console.log(apiURL);
			// checkStatusesUpdate(key, apiURL, social)(); 
		}
	}
}


function checkStatusesUpdate(key, apiURL, social) {
	return function() {
		$.ajax({
			url: apiURL,
			type: "GET",
			dataType: "json",
			success: function(data) {

				console.log(key + "-" + social + ": " + Date());

				var unreadStatuses, 
					notifAmount;

				var statuses,
					timestamp;
				switch (social) {
					case "weibo":
						statuses = data.statuses;
						timestamp = "created_at";
						break;
					case "renren":
						statuses = data.response;
						timestamp = "time";
						break;
					case "renrenSimple":
						statuses = data.response;
						timestamp = "createTime";
						break;
					default:
						break;
				}

				var checkPoint = $.evalJSON(localStorage.getItem("checkPoint"));

				if (checkPoint[key][social] !== "") {
					// var lastCheckPoint = new Date(checkPoint[key][social]);
					lastCheckPoint = new Date("2013-2-23 23:25:58");

					for (var i = 0; i < statuses.length; i++) {
						var status = statuses[i];

						if ( (social !== "renren") || ((social === "renren") && (status.type !== "UPDATE_STATUS")) ) {
							var createdAt = new Date(status[timestamp]);
							if (createdAt > lastCheckPoint) {
								if(0 === i) {
									checkPoint[key][social] = status[timestamp];
									localStorage.setItem("checkPoint", $.toJSON(checkPoint));	
								}
								unreadStatuses = $.evalJSON(localStorage.getItem("unreadStatuses"));
								unreadStatuses[key][social+"-"+status.id] = {
									"type": social, 
									"timestamp": status[timestamp], 
									"data": status
								};
								localStorage.setItem("unreadStatuses", $.toJSON(unreadStatuses));

								notifAmount = parseInt((localStorage.getItem("notifAmount")));
								localStorage.setItem("notifAmount", ++notifAmount);

							} else {
								break;
							}
						}
					}
				} else if (typeof statuses[0] !== "undefined") {
					checkPoint[key][social] = statuses[0][timestamp];
					localStorage.setItem("checkPoint", $.toJSON(checkPoint));
				} else {
					checkPoint[key][social] = new Date("2008-3-2 20:00:00");
					localStorage.setItem("checkPoint", $.toJSON(checkPoint));
				}

				notifAmount = parseInt((localStorage.getItem("notifAmount")));
				if(notifAmount > 0) {
					chrome.browserAction.setBadgeText({text: "" + notifAmount});
				} else {
					chrome.browserAction.setBadgeText({text: ""});
				}	
			},
			error: function(data) {
				console.log("UserTimeLine Ajax Error: " + key + ", " + social);
			}
		});

		setTimeout(checkStatusesUpdate(key, apiURL, social), 30000);
	};
	
}