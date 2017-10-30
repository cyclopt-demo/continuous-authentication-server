import sys
import json as json
import operator
import math
import numpy as np
from sklearn import mixture

#---------------------------------------------------------------------
# Constants
DI_CHAR_OFFSET = 64  # beggins from number (0,9) char
ALPHABET_LENGTH = 27  # 26 characters and 1 character extra representing all numbers
# OUTLIER_TRAINDATA_MIN = 15
# OUTLIER_TRAINDATA_MAX = 2500
# MINIMUM_SAMPLES = 10


#---------------------------------------------------------------------
# Functions

# Function sendToNode: is used to send data to node processs as json
def send_to_node(data):
    message = {'data': data}
    print json.JSONEncoder().encode(message)

# Function receive_from_node: is used to receive from node via stdin
# the results are decoded from json to python object


def receive_from_node():
    for i in sys.stdin:
        data = i
    data = json.JSONDecoder().decode(data)
    return data

# Function that returns the square numbers of a list


def square_list(my_list):
    return [math.sqrt(my_val) for my_val in my_list]


#--------------------------------------------------------------------
# Main Stuff Starts Here



# Receive collections from node call send
DATA = receive_from_node()
COLLECTION_DOCS = DATA['docs']
N_COMPONENTS = DATA['training_n_components']
OUTLIER_TRAINDATA_MIN = DATA['training_outlier_min_dt']
OUTLIER_TRAINDATA_MAX = DATA['training_outlier_max_dt']
MINIMUM_SAMPLES = DATA['training_digraph_min_samples']

send_to_node('-Hello from python: I am training data with settings = '
             + str(N_COMPONENTS) + ', ' + str(OUTLIER_TRAINDATA_MIN) + ', ' + str(OUTLIER_TRAINDATA_MAX) + ', ' + str(MINIMUM_SAMPLES))

# for doc in COLLECTION_DOCS:
#     send_to_node(doc)
# send_to_node(COLLECTION_DOCS[1])
# sys.exit()

# Organize the data to list of dictionaries, eg:
# [ {subject: 'user1', di_data:  [], di_gmms: [] } , {subject: 'user2',
# di_data:  [], di_gmms: [] } , etc etc]
listdict_users_data = []

# For each document (subject) of collection_docs
for doc in COLLECTION_DOCS:
    # get subjects name
    listdict_users_data.append({'subject': doc['subject']})
    # get all the data from all its sessions and put them to the lists
    # di_code (its a Nx2 list) and di_dt (Nx1)
    di_code = []
    di_dt = []
    sessions = doc['sessions']
    # For each session of this subject, merge all the keydata of all the sessions of this subject to two arrays
    for i, val in enumerate(sessions):
        [di_code.append(x) for x in val['keystroke_code']]
        [di_dt.append(x) for x in val['keystroke_dt']]

    # Organization of the digraph data:
    # First sort it according to digraph like this: aa,ab,ac,ad....,zy,zz
    di_tuples = sorted(zip(di_code, di_dt), key=operator.itemgetter(0, 1))

    # Now put the timing (dt) data in a nested list: [ [20,34,23], [23,43,23] ] etc
    # Each subarray of the list represents the latencies for each digraph beggining
    # from ##,#a,#b,#c......,zy,zz
    # Imagine it like a flattened 2d array (by row, 27x27)
    # with each entry containing a vector of arbitrary length
    le = len(listdict_users_data)  # index of subject
    listdict_users_data[le - 1]['di_data'] = \
        [None] * (ALPHABET_LENGTH *
                  ALPHABET_LENGTH)  # Empty 27x27 list of vectors

    i = -1
    j = -1
    for val in di_tuples:
        if i != val[0][0] or j != val[0][1]:  # new digraph
            i = val[0][0]
            j = val[0][1]
            listdict_users_data[le - 1]['di_data'][(
                i - DI_CHAR_OFFSET) * ALPHABET_LENGTH + (j - DI_CHAR_OFFSET)] = [val[1]]

        else:
            listdict_users_data[le - 1]['di_data'][(
                i - DI_CHAR_OFFSET) * ALPHABET_LENGTH + (j - DI_CHAR_OFFSET)].append(val[1])

    # Perform Gaussian Mixture Model for each Digraph
    listdict_users_data[le - 1]['di_gmms'] = \
        [None] * (ALPHABET_LENGTH *
                  ALPHABET_LENGTH)  # Empty 27x27 list of vectors
    for i in range(0, ALPHABET_LENGTH):
        for j in range(0, ALPHABET_LENGTH):
            traindata = listdict_users_data[le -
                                            1]['di_data'][i * ALPHABET_LENGTH + j]
            # Ignore empties
            if traindata is None:
                continue
            # Ignore small samples
            if len(traindata) < MINIMUM_SAMPLES:
                continue
            else:
                # Ignore outliers (noise) in traindata
                traindata = [da for da in traindata if da >= OUTLIER_TRAINDATA_MIN
                             and da <= OUTLIER_TRAINDATA_MAX]
                # Maybe all those data are outliers so continue (traindata == [])
                if (not traindata):
                    continue
                # Apply GMM to traidata and save its attributes to the di_gmms list
                myGMM = mixture.GaussianMixture(n_components=N_COMPONENTS).fit(
                    np.reshape(traindata, (-1, 1)))
                # (the gmm model attributes are a little ugly, nested lists etc etc)
                flatMeans = [mean for sublist in myGMM.means_.tolist()
                             for mean in sublist]
                flat2dCovs = [cov for sublist in myGMM.covariances_.tolist()
                              for cov in sublist]
                flat2dCovs = [cov for sublist in flat2dCovs for cov in sublist]
                # also save the digraph itself as string
                str_digraph = (chr(i + DI_CHAR_OFFSET) +
                               chr(j + DI_CHAR_OFFSET)).replace('@', '#').lower()
                listdict_users_data[le - 1]['di_gmms'][i * ALPHABET_LENGTH + j] = \
                    {'digraph': str_digraph, 'data': traindata, 'labels': myGMM.predict(
                        np.reshape(traindata, (-1, 1))).tolist(), 'weights': myGMM.weights_.tolist(
                    ), 'means': flatMeans, 'covs': flat2dCovs, 'stds': square_list(flat2dCovs)}


# ---
send_to_node('---I am python and I am finished')
# Send it back to node
send_to_node(listdict_users_data)


# print listdict_users_data
