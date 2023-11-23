// ローカライズ処理
var label_list = document.querySelectorAll("[class^=option_label_]");
for (var i = 0; i < label_list.length; i++) {
	while (label_list[i].firstChild) {
		label_list[i].removeChild(label_list[i].firstChild);
	}
	const class_name = label_list[i].className.split(" ")[0];

	// Split translation text into lines, then add <br> element to line for correct appearance.
	var labeltextlines = browser.i18n.getMessage(class_name).replace(/(?:\r\n|\r|\n)/g, "\n").split("\n");
	var j;
	for (j = 0; j < (labeltextlines.length - 1); j++) {
		label_list[i].appendChild(document.createTextNode(labeltextlines[j]));
		label_list[i].appendChild(document.createElement('br'));
	}
	label_list[i].appendChild(document.createTextNode(labeltextlines[j]));

}

function debug_check_storage_data() {
	let getting = browser.storage.local.get();
	getting.then(function(result){
		console.log("ストレージデータ");
		console.log(result);
	}, function(error){
		console.log(`Error: ${error}`);
	});
}

let acount_element = document.querySelector("select[name=acount]");
function init() {
	// アカウント変更時の処理
	acount_element.addEventListener("change", function(){
		// 保存されてるテンプレートを入力欄に復元する。
		let storage_key_body = "acount_template_" + this.value;
		let storage_key_is_html = "acount_template_is_html_" + this.value;
		
		let getting = browser.storage.local.get([storage_key_body, storage_key_is_html]);
		getting.then(function(result){
			document.querySelector("textarea[name=template_body]").value = typeof result[storage_key_body] !== "undefined" ? result[storage_key_body] : "";
			document.querySelector("input[name=is_template_body_html]").checked = typeof result[storage_key_is_html] !== "undefined" ? result[storage_key_is_html] : false;
		}, function(error){
			console.log(`Error: ${error}`);
		});
	});
	
	async function init_acount() {
		// アカウントの選択肢をいったん消す。
		while (acount_element.firstChild) {
			acount_element.removeChild(acount_element.firstChild);
		}
		
		// 「共通」の選択肢を追加する。
		let common_option_element = document.createElement("option");
		common_option_element.value = "common";
		common_option_element.innerText = browser.i18n.getMessage("from_id_common_label");
		acount_element.appendChild(common_option_element);
		
		// 登録されているアカウントを選択肢に追加する。
		let acount_list = await browser.accounts.list();
		for (const acount_data of acount_list) {
			if (acount_data.type == "none") {
				continue;
			}
			let option_element = document.createElement("option");
			option_element.value = acount_data.id;
			option_element.innerText = acount_data.name;
			acount_element.appendChild(option_element);
		}
		
		const change = new Event("change");
		acount_element.dispatchEvent(change);
	}
	init_acount();
	
	// アカウントが登録された場合はアカウントの選択肢を作り直す。
	browser.accounts.onCreated.addListener(async (id, changedValues) => {
		init_acount();
	});
	
	// アカウントが更新された場合はアカウントの選択肢を作り直す。
	browser.accounts.onUpdated.addListener(async (id, changedValues) => {
		init_acount();
	});
	
	// アカウントが削除された場合は保存している設定値を消しつつアカウントの選択肢を作り直す。
	browser.accounts.onDeleted.addListener(async (id, changedValues) => {
		let storage_key_body = "acount_template_" + id;
		let storage_key_is_html = "acount_template_is_html_" + id;
		await browser.storage.local.remove(storage_key_body);
		await browser.storage.local.remove(storage_key_is_html);
		
		init_acount();
	});
}

// 「保存する」ボタン押下時の保存処理
function saveOptions(e) {
	e.preventDefault();
	
	let storage_key_body = "acount_template_" + acount_element.value;
	let storage_key_is_html = "acount_template_is_html_" + acount_element.value;
	browser.storage.local.set({
		[storage_key_body]: document.querySelector("textarea[name=template_body]").value,
		[storage_key_is_html]: document.querySelector("input[name=is_template_body_html]").checked,
	}).then(function(){
		alert(browser.i18n.getMessage("option_label_save_complete"));
	}, function(error){
		alert(browser.i18n.getMessage("option_label_save_error") + "\n" + error);
	});
}

document.addEventListener("DOMContentLoaded", init);
document.querySelector("form").addEventListener("submit", saveOptions);
