import requests
import json
import os


appid = os.environ['DISCORD_APP_ID']
token = os.environ['DISCORD_TOKEN']
id = os.environ['COMMAND_ID']

# url = "https://discord.com/api/v8/applications/<my_application_id>/commands"
url = 'https://discord.com/api/v8/applications/{}/commands/{}'.format(appid,id)
headers = {"Authorization": "Bot {}".format(token)}

r = requests.delete(url, headers=headers)
print(r)


