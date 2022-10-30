import requests
import json
import os


appid = os.environ['DISCORD_APP_ID']
token = os.environ['DISCORD_TOKEN']


data = {
    "name": "start",
    "type": 1,
    "description": "サーバーを起動する",
    "options": [
      {
        "name": "server",
        "description": "サーバーの種類 ",
        "type": 3,
        "required": True,
        "choices": [
          {
            "name": "pve01",
            "value": "sdtdPVE01"
            },
          {
            "name": "pve02",
            "value": "sdtdPVE02"
            },
          ]
        },
      ]
    }

# url = "https://discord.com/api/v8/applications/<my_application_id>/commands"
url = 'https://discord.com/api/v8/applications/{}/commands'.format(appid)
headers = {"Authorization": "Bot {}".format(token)}

print("url:{}, headers:{}".format(url, headers))
r = requests.post(url, headers=headers, json=data)
print(r)
print(json.dumps(json.loads(r.text), indent=2))

