// 挿入するテンプレートを取得する。
async function get_template_data(account_id) {
	let storage_key_body = "acount_template_" + account_id;
	let storage_key_is_html = "acount_template_is_html_" + account_id;
	
	let template_data = await browser.storage.local.get([storage_key_body, storage_key_is_html]);
	let result = typeof template_data[storage_key_body] !== "undefined" ? template_data[storage_key_body] : "";
	let is_html = typeof template_data[storage_key_is_html] !== "undefined" ? template_data[storage_key_is_html] : false;
	
	if (!is_html) {
		// HTMLとして意味のある記号をエスケープする。
		let escape_element = document.createElement("span");
		
		// ※改行がbrタグに置き換わる。
		escape_element.innerText = result;
		result = escape_element.innerHTML;
		
		// おそらくこの処理は無くてもOKか？
		result = result.replace(/(\r\n|\r|\n)/g, "<br>");
	}
	
	return result;
}

// タブごとのテンプレート履歴
// 差出人変更時に以前挿入したテンプレートを消すために使う。
let tab_template_history = {};

// タブごとのテンプレート挿入判定
let tab_is_disable_template = {};

function sleep(time) {
 	return new Promise((resolve) => setTimeout(resolve, time));
}


// Thunderbird 143以降でsetComposeDetails実行時にインライン画像が消える現象の対策用の処理。
// https://bugzilla.mozilla.org/show_bug.cgi?id=1997519
// ↑によるとimgタグを「<img src="mailbox://・・・」 → 「<img src="data:image/・・・」というように置き換える処理が走っているらしく、
// この処理と並行してメール本文を書き換えてしまうとインライン画像が表示されなくなるっぽい？
// imgタグの展開処理が終わるまで待てば良いらしいので、待機させる。
// Thunderbird 148で対策されるっぽいが、しばらく待つことになるので対策を入れておく。
async function wait_conversion_inline_image(tab_id) {
	let compose_data;
	let i = 0;
	do {
		compose_data = await browser.compose.getComposeDetails(tab_id);
		
		if (compose_data.body.includes('<img src="mailbox://') || compose_data.body.includes('<img src="imap://')) {
			await sleep(100);
		}
		
		i++;
	} while(i < 10);
}

// テンプレート挿入処理
async function set_tempalte(tab) {
	// v143以降でインライン画像が消えてしまう現象の対策
	await wait_conversion_inline_image(tab.id);
	
	
	let compose_data = await browser.compose.getComposeDetails(tab.id);
	/*
	console.log("メールデータ");
	console.log(compose_data);
	console.log(compose_data.subject);
	console.log(compose_data.body);
	*/
	
	
	if (typeof tab_is_disable_template[tab.id] == "undefined") {
		let is_disable_template = false;
		
		if (compose_data.type == "draft") {
			// 下書きデータを再開した場合はテンプレートをセットしない。
			is_disable_template = true;
			
		} else if (compose_data.type == "redirect") {
			// リダイレクトの場合はそのままにしておいた方が良いのでテンプレートをセットしない。
			is_disable_template = true;
		
		} else 	if (compose_data.type == "new") {
			// 環境によってはうまく判定できず、まっさらな新規作成時にもテンプレートが挿入されなくなってしまったので、
			// 新規作成の場合は常にテンプレートを挿入することにした。
			null;
			
			// 以下廃止コード
			/*
			// 新規メッセージの作成時に元ネタがある場合はテンプレートをセットしない。
			// 確認したパターンは以下のもの。
			// ・既存のメールから「新しいメッセージとして編集」で呼び出された場合
			// ・テンプレートファイルから呼び出された場合
			if (compose_data.relatedMessageId != null) {
				// v115あたりは「relatedMessageId」に値が入って来ていたが、
				// 新しいバージョンでは入ってこなくなっている。
				is_disable_template = true;
			} else if (typeof compose_data.isModified !== "undefined" && compose_data.isModified === false) {
				// 新しいバージョンでは「isModified」が追加されて、
				// 元ネタがある状態で新規作成した場合は「false」が設定されている様子。
				// 追記：環境によってはそうでもなかったので、この判定だとミスる。
				is_disable_template = true;
			}
			*/
		}
		
		tab_is_disable_template[tab.id] = is_disable_template;
	}
	
	if (tab_is_disable_template[tab.id]) {
		return;
	}
	
	
	let from_identity_data = await browser.identities.get(compose_data.identityId);
	
	let template = await get_template_data(from_identity_data.accountId);
	if (template.length == 0) {
		template = await get_template_data("common");
	}
	
	// 転送時にbodyタグにstyle属性が付くことがあるので、正規表現でbodyの開始タグを特定する。
	let body_tag_open_match = compose_data.body.match(/<body.*?>/);
	if (body_tag_open_match == null) {
		// bodyタグが見つけられないのでテンプレートが挿入できない。(通常は無いハズ)
		return;
	}
	
	let body_tag_open = body_tag_open_match[0];
	let body_parts = compose_data.body.split(body_tag_open);
	/*
	console.log("parts");
	console.log(body_parts);
	*/
	
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
	
	let new_body = body_parts.join(body_tag_open);
	
	/*
	console.log("テンプレート挿入後本文");
	console.log(new_body);
	*/
	
	// テンプレート付きの本文をメール作成画面にセットする。
	// ※setComposeDetails関数でbodyだけセットするとIMEが効かなくなる。
	compose_data.body = new_body;
	browser.compose.setComposeDetails(tab.id, compose_data);
	
	// NGコード
	// browser.compose.setComposeDetails(tab.id, {body: new_body});
	
	
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
	delete tab_is_disable_template[tabId];
});

// 差出人変更時のイベント
browser.compose.onIdentityChanged.addListener(async (tab, identityId) => {
	// 変更した差出人用のテンプレートに差し替える。
	set_tempalte(tab);
});

