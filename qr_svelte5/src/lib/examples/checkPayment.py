#!/usr/bin/python3

from http.client import HTTPConnection
from sys import argv, exit
import urllib.request
from base64 import b64encode
import re
import json

REQUEST_URL = "/info/payments/byid/"


user = "demo"
pw = "demo"

domain = "your billing page"

try:
    argv[1]
except IndexError:
    exit("Ошибка: отсутствует идентификатор платежа.")
else:
    id = argv[1]

encstr = (user+":"+pw).encode('ascii')
hstr = b64encode(encstr).decode('ascii')

try:
    pw
except NameError:
    exit("domain not found!")
else:
    print("Connecting...")

headers = { 'Authorization' : 'Basic %s' %  hstr }
c = HTTPConnection(domain)
c.request('GET', REQUEST_URL+"?id="+id, headers = headers)
res = c.getresponse()
data = res.read().decode('ascii')

if data == "":
    exit("No data!")

data = json.loads(data)

for key, value in data[0].items():
    print(key+": "+str(value))