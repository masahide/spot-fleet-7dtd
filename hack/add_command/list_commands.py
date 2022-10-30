import requests
import json
import os


appid = os.environ['DISCORD_APP_ID']
token = os.environ['DISCORD_TOKEN']

# url = "https://discord.com/api/v8/applications/<my_application_id>/commands"
url = 'https://discord.com/api/v8/applications/{}/commands'.format(appid)
headers = {"Authorization": "Bot {}".format(token)}

r = requests.get(url, headers=headers)
print(r)
print(json.dumps(json.loads(r.text), indent=2))

