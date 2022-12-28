// 挿入するテンプレートを取得する。
async function get_template_data(account_id) {
	let storage_key = "acount_template_" + account_id;
	let template_data = await browser.storage.local.get(storage_key);
	let result = typeof template_data[storage_key] !== "undefined" ? template_data[storage_key] : "";
	
	result = result.replace(/(\r\n|\r|\n)/g, "<br>");
	return result;
}

// タブごとのテンプレート履歴
// 差出人変更時に以前挿入したテンプレートを消すために使う。
let tab_template_history = {};

// テンプレート挿入処理
async function set_tempalte(tab) {
	let compose_data = await browser.compose.getComposeDetails(tab.id);
	/*
	console.log("メールデータ");
	console.log(compose_data);
	console.log(compose_data.subject);
	console.log(compose_data.body);
	*/

	if (compose_data.type == "draft") {
		// 下書きデータを再開した場合はテンプレートをセットしない。
		return;
	} else if (compose_data.type == "redirect") {
		// リダイレクトの場合はそのままにしておいた方が良いのでテンプレートをセットしない。
		return;
	} else 	if (compose_data.type == "new" && compose_data.relatedMessageId != null) {
		// 新規メッセージの作成時に元ネタがある場合はテンプレートをセットしない。
		// 確認したパターンは以下のもの。
		// ・既存のメールから「新しいメッセージとして編集」で呼び出された場合
		// ・テンプレートファイルから呼び出された場合
		return;
	}
	
	let from_identity_data = await browser.identities.get(compose_data.identityId);
	
	let template = await get_template_data(from_identity_data.accountId);
	if (template.length == 0) {
		template = await get_template_data("common");
	}
	let body_parts = compose_data.body.split("<body>");
	
	// 差出人を変更した際に未編集の古いテンプレートがある場合は取り除く。
	if (typeof tab_template_history[tab.id] !== "undefined" && body_parts[1].indexOf(tab_template_history[tab.id]) === 0) {
		body_parts[1] = body_parts[1].substring(tab_template_history[tab.id].length);
	}
	
	if (template.length != 0) {
		// 差出人変更時になぜか先頭の改行が1個消えるので1個増やす。
		if (body_parts[1].indexOf('<br><pre class="moz-') === 0) {
			body_parts[1] = "<br>" + body_parts[1];
		}
		
		body_parts[1] = template + body_parts[1];
	}
	
	// 差出人変更時に末尾の改行がなぜか1個増えるので1個削除する。
	body_parts[1] = body_parts[1].replace("<br><br></body></html>", "<br></body></html>");
	
	let new_body = body_parts.join("<body>");
	
	browser.compose.setComposeDetails(tab.id, {body: new_body});
	
	tab_template_history[tab.id] = template;
}

// タブを開いた場合のイベント
// メッセージ作成画面もタブ扱いらしい。
browser.tabs.onCreated.addListener(async (tab) => {
	if (tab.type == "messageCompose") {
		// メッセージ作成画面の場合
		set_tempalte(tab);
	}
});

// タブが閉じられた場合はそのタブ用のテンプレート履歴を削除する。
browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
	delete tab_template_history[tabId];
});

// 差出人変更時のイベント
browser.compose.onIdentityChanged.addListener(async (tab, identityId) => {
	// 変更した差出人用のテンプレートに差し替える。
	set_tempalte(tab);
});

