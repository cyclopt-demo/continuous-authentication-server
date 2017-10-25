import sys
import json as json
import operator
import numpy as np
from sklearn import mixture

#---------------------------------------------------------------------
# Constants
DI_CHAR_OFFSET = 64 # beggins from
ALPHABET_LENGTH = 27 # 26 characters and 1 character extra representing all numbers
DELTA = 1 # distance used to calculate zone of acceptance (DELTA * sigma)
#THRESHOLD = 0.8 # determines if the user passes the test or not
# OUTLIER_TRAINDATA_MIN = 15 Edw xriazontai outliers gia ta testing?
# OUTLIER_TRAINDATA_MAX = 750


#---------------------------------------------------------------------
# Functions

# Function sendToNode: is used to send data to node processs as json
def send_to_node(data):
    message = {'data':data}
    print json.JSONEncoder().encode(message)

# Function receive_from_node: is used to receive from node via stdin
# the results are decoded from json to python object
def receive_from_node():
    for i in sys.stdin:
        data = i
    data = json.JSONDecoder().decode(data)
    return data




#--------------------------------------------------------------------
# Main Stuff Starts Here
send_to_node('-Hello from python: I am testing data.')

# Receive collections from node call send
DATA = receive_from_node()

# Extract stuff from DATA
TRAINED_GMMS_DIGRAPHS_LIST = DATA['di_gmms']
TESTING_DATA = DATA['testing']
N_COMPONENTS = DATA['n_components']
THRESHOLD = DATA['testing_threshold']

# send_to_node(str(THRESHOLD))

# Find how much components (by default is 2 in the future the trained model components may be more)
# N_COMPONENTS = 0
# for gmm in TRAINED_GMMS_DIGRAPHS_LIST:
#     # send_to_node(gmm)
#     if gmm is None:
#         continue
#     else:
#         N_COMPONENTS = len(gmm['weights'])

###########DEBUGGING
# TRAINED_GMMS_DIGRAPHS_LIST = [  {'_id': 'a', 'weights': [0.19, 0.8], 'stds': [240, 313], 'means': [142, 94] }, \
#     {'_id': 'b', 'weights': [0.25, 0.75], 'stds': [100, 400], 'means': [1432, 394] }, \
#      {'_id': 'c', 'weights': [0.8, 0.2], 'stds': [30, 23], 'means': [1424, 294] }    ]
# TESTING_DATA = { 'keystroke_code': [[30,36], [30, 35], [30, 35],[20, 25], [35, 20]], 'keystroke_dt': [30, 90, 50, 30, 40] }
#############

# Sort digraphs and dt in tuples in ascending order
di_tuples = sorted(zip(TESTING_DATA['keystroke_code'], TESTING_DATA['keystroke_dt']), key=operator.itemgetter(0, 1)) # pylint: disable=C0103,C0301
# Group digraphs
testing_data_grouped = [] # pylint: disable=C0103
for di_tuple in di_tuples:
    if not testing_data_grouped:
        testing_data_grouped.append({'di': di_tuple[0], 'dt': [di_tuple[1]]})
    elif testing_data_grouped[len(testing_data_grouped) - 1]['di'] == di_tuple[0]:
        testing_data_grouped[len(testing_data_grouped) -1]['dt'].append(di_tuple[1])
    else:
        testing_data_grouped.append({'di': di_tuple[0], 'dt': [di_tuple[1]]})


# send_to_node(testing_data_grouped)

# Initialize variables
count_non_nulls = 0 # pylint: disable=C0103


S = [] # Similarity score for every component for every digraph  eg: [ [5.3,2.6], [2.5,2,1] ... etc  ]

# For each digraph data
for index, di_data in enumerate(testing_data_grouped):

    # Load the particular digraph model
    i = di_data['di'][0] - DI_CHAR_OFFSET
    j = di_data['di'][1]  - DI_CHAR_OFFSET
    # send_to_node({'i':i,'j':j})

    gmm_model = TRAINED_GMMS_DIGRAPHS_LIST[i*ALPHABET_LENGTH + j]

    # Check if model exists, or training  do not exist for this digraph
    if gmm_model is None:
        S.append(-1)
    else:
        count_non_nulls = count_non_nulls + len(di_data['dt'])
        # For each component
        for n in range(N_COMPONENTS):

            # Load  statistics of this model
            w = gmm_model['weights'][n]
            sigma = gmm_model['stds'][n]
            mu = gmm_model['means'][n]
            zone_of_acceptance = DELTA * sigma

            _pass = 0 # pylint: disable=C0103

            # Test each digraph timing sample against that model
            for dt in di_data['dt']:
                if dt >= (mu - zone_of_acceptance) and dt <= (mu + zone_of_acceptance):
                    _pass = _pass + 1

            # Compute Similarity Score for this digraph with the weight of component

            if n == 0:
                S.append([_pass*w])
            else:
                S[index].append(_pass * w)


# Compute a final similarity score to dermine if user is genuine
if count_non_nulls == 0:
    send_to_node({'not_enough_training': True})
else:
    TS = 0
    for score in S:
        if score != -1:
            TS = TS + sum(score)

    TS = TS / count_non_nulls
    passed = True if TS >= THRESHOLD else False # pylint: disable=C0103
    send_to_node({'passed': passed, 'TS': TS, 'S': S, 'not_enough_training': False})
