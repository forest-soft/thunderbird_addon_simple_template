// ローカライズ処理
var label_list = document.querySelectorAll("[class^=option_label_]");
for (var i = 0; i < label_list.length; i++) {
	while (label_list[i].firstChild) {
		label_list[i].removeChild(label_list[i].firstChild);
	}
	const class_name = label_list[i].className.split(" ")[0];
	label_list[i].appendChild(document.createTextNode(browser.i18n.getMessage(class_name)));
}


let acount_element = document.querySelector("select[name=acount]");
function init() {
	// アカウント変更時の処理
	acount_element.addEventListener("change", function(){
		// 保存されてるテンプレートを入力欄に復元する。
		let storage_key = "acount_template_" + this.value;
		var getting = browser.storage.local.get(storage_key);
		getting.then(function(result){
			document.querySelector("textarea[name=template_body]").value = typeof result[storage_key] !== "undefined" ? result[storage_key] : "";
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
		let storage_key = "acount_template_" + id;
		await browser.storage.local.remove(storage_key);
		
		init_acount();
	});
}

// 「保存する」ボタン押下時の保存処理
function saveOptions(e) {
	e.preventDefault();
	
	let storage_key = "acount_template_" + acount_element.value;
	browser.storage.local.set({
		[storage_key]: document.querySelector("textarea[name=template_body]").value
	}).then(function(){
		alert(browser.i18n.getMessage("option_label_save_complete"));
	}, function(error){
		alert(browser.i18n.getMessage("option_label_save_error") + "\n" + error);
	});
}

document.addEventListener("DOMContentLoaded", init);
document.querySelector("form").addEventListener("submit", saveOptions);
