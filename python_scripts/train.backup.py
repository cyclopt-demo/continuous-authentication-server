import sys
import json as json
import operator
import numpy as np
from pymongo import MongoClient
from sklearn import mixture
# import matplotlib.pyplot as plt

#---------------------------------------------------------------------
# Functions

# Function sendToNode: is used to send data to node processs as json
def send_to_node(data):
    message = {'data':data}
    print json.JSONEncoder().encode(message)





#---------------------------------------------------------------------
# Constants
TRACK_CODE = sys.argv[1] # this comes from node call
DI_CHAR_OFFSET = 65 # beggins from 'A' char
OUTLIER_TRAINDATA_MIN = 15
OUTLIER_TRAINDATA_MAX = 750

# Database Info
DB_NAME = 'keystroketest'
DB_HOST = 'ds127101.mlab.com'
DB_PORT = 27101
DB_USER = 'test_tasos'
DB_PASS = 'abc123_test'



#--------------------------------------------------------------------
# Main Stuff Starts Here
send_to_node('-Hello from python.')
if len(sys.argv) < 2:
    # print '---Arguments missing. Exiting...'
    sys.exit()

# print '---Attempting to train model with track_code', sys.argv[1]


# ---
# Actual Stuff Starts Here

# Connect to database and authentinticate
CONNECTION = MongoClient(DB_HOST, DB_PORT)
DB = CONNECTION[DB_NAME]
DB.authenticate(DB_USER, DB_PASS)
# Get the desired collection
COLLECTION = DB['keystrokedatamodels']
# Get all the documents of this collection
COLLECTION_DOCS = COLLECTION.find({'track_code':TRACK_CODE})

# --------
# Organize the data to list of dictionaries:
# [ {user: 'deagle', di_data:  [], di_gmms: [] } , {user: 'user2',
# di_data:  [], di_gmms: [] } , etc etc]
listdict_users_data = []

# For each document (subject) of collection_docs
for doc in COLLECTION_DOCS:
    # get subjects name
    listdict_users_data.append({'subject':doc['subject']})
    # get all the data from all its sessions and put them to the lists
    # di_code (its a Nx2 list) and di_dt (Nx1)
    di_code = []
    di_dt = []
    sessions = doc['sessions']
    for i, val in enumerate(sessions):
        [di_code.append(x) for x in val['keystroke_code']]
        [di_dt.append(x) for x in val['keystroke_dt']]

    # Organization of the digraph data:
    # First sort it according to digraph like this: aa,ab,ac,ad....,zy,zz
    di_tuples = sorted(zip(di_code, di_dt), key=operator.itemgetter(0, 1))

    # Now put the data in a nested list: [ [20,34,23], [23,43,23] ] etc
    # Each subarray of the list represents the latencies for each digraph.
    # Its like a 2d array (26x26) with each cell represneting
    # a digraph beginning from 'aa'
    # Imagine it like a flattened 2d array (by row, 26x26)
    # with each entry containing a vector of arbitrary length
    le = len(listdict_users_data)
    listdict_users_data[le - 1]['di_data'] = [[None]] * (26*26) # Empty 26x26 list of vectors

    i = -1
    j = -1
    for val in di_tuples:
        if i != val[0][0] or j != val[0][1]:
            i = val[0][0]
            j = val[0][1]
            listdict_users_data[le - 1]['di_data'][(i-DI_CHAR_OFFSET)*26 +(j-DI_CHAR_OFFSET)] \
            = [val[1]]
        else:
            listdict_users_data[le - 1]['di_data'][(i-DI_CHAR_OFFSET)*26 +(j-DI_CHAR_OFFSET)] \
            .append(val[1])

    # Perform Gaussian Mixture Model for each Digraph
    listdict_users_data[le - 1]['di_gmms'] = [None] * (26*26) # Empty 26x26 list of vectors
    for i in range(0, 26):
        for j in range(0, 26):
            traindata = listdict_users_data[le-1]['di_data'][i*26+j]
            # Ignore small samples
            if len(traindata) < 10:
                continue
            else:
                # Ignore outliers (noise) in traindata
                traindata = [da for da in traindata if da >= OUTLIER_TRAINDATA_MIN \
                and da <= OUTLIER_TRAINDATA_MAX]
                # Apply GMM to traidata and save its attributes to the di_gmms list
                myGMM = mixture.GaussianMixture(n_components=2).fit(np.reshape(traindata, (-1, 1)))
                listdict_users_data[le - 1]['di_gmms'][i*26+j] = vars(myGMM)


    # -------
    # Save the listdict with the trained models back to database






# ------
# Message back to node
# print '------Model succesfully trained and saved to database.'


# print listdict_users_data
# # Form a dict
# digraph = dict.fromkeys(['dt','code'], None)


# plt.figure()
# plt.xlabel("Latency (ms)")
# # plt.ylabel("Throughput (mb/s)")
# plt.plot(digraph['dt'],np.zeros_like(digraph['dt']), 'x')
# plt.show()
