import json

with open('e:/foodiempt-main/eslint_report.json', 'r') as f:
    report = json.load(f)

for file in report:
    if file['errorCount'] > 0 or file['warningCount'] > 0:
        print(f"File: {file['filePath']}")
        print(f"Errors: {file['errorCount']}, Warnings: {file['warningCount']}")
        for msg in file['messages']:
            print(f"  Line {msg['line']}: {msg['message']} ({msg['ruleId']})")
        print("-" * 40)
