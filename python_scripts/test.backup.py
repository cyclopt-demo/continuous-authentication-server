import sys
import json as json
import operator
import numpy as np
from sklearn import mixture

#---------------------------------------------------------------------
# Constants
DI_CHAR_OFFSET = 64 # beggins from 'A' char
ALPHABET_LENGTH = 27 # 26 characters and 1 character extra representing all numbers
DELTA = 1 # distance used to calculate zone of acceptance (DELTA * sigma)
THRESHOLD = 0.8 # determines if the user passes the test or not
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

###########DEBUGGING
# TRAINED_GMMS_DIGRAPHS_LIST = [  {'_id': 'a', 'weights': [0.19, 0.8], 'covs': [240, 313], 'means': [142, 94] }, \
#     {'_id': 'b', 'weights': [0.25, 0.75], 'covs': [100, 400], 'means': [1432, 394] }, \
#      {'_id': 'c', 'weights': [0.8, 0.2], 'covs': [30, 23], 'means': [1424, 294] }    ]
# TESTING_DATA = { 'keystroke_code': [[20, 25], [30, 35],[40, 42], [90, 91]], 'keystroke_dt': [10, 20, 30, 40] }
#############

# Initialize variables
count = 0 # pylint: disable=C0103
_pass = 0 # pylint: disable=C0103

# Begin testing each digraph
for i, dt in enumerate(TESTING_DATA['keystroke_dt']):
    #send_to_node({'di':digraph})
    di = TESTING_DATA['keystroke_code'][i]
    #print (di,dt)
    # Calculate index from the digraph and load the model
    n = di[0] - DI_CHAR_OFFSET
    m = di[1] - DI_CHAR_OFFSET
    gmm_model = TRAINED_GMMS_DIGRAPHS_LIST[n*ALPHABET_LENGTH + m]
    # send_to_node(gmm_model)

    if gmm_model != None:
        # Test the dt against the model for each component
        for c in range(len(gmm_model['weights'])):
            count = count + 1 # used later to calculate average
            # send_to_node(gmm_model['weights'][c])
            w = gmm_model['weights'][c]
            sigma = gmm_model['covs'][c]
            mu = gmm_model['means'][c]
            zone_of_acceptance = DELTA * sigma
            if dt >= (mu - zone_of_acceptance) and dt <= (mu + zone_of_acceptance):
                _pass = _pass + w
                send_to_node('digraph passed')


# Determine if user has passed the test
if count != 0:
    _pass = _pass / (count/2) # pylint: disable=C0103
    if _pass > THRESHOLD:
        send_to_node({'passed': True, 'score': _pass, 'not_enough_training': False})
    else:
        send_to_node({'passed': False, 'score': _pass, 'not_enough_training': False})
else:
    send_to_node({'not_enough_training': True })

