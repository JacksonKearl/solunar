# just for funzies, try building a model that guesses harcon data based on lat/lng

import json
import pandas as pd
import math
import numpy as np
from keras.models import Sequential
from keras.layers import Dense, Dropout
from sklearn.model_selection import train_test_split


with open('stations_clean.json') as f:
    data = json.load(f)

df = pd.DataFrame(data)

constituents = [
    'M2', 'K1', 'O1', 'S2'
]

ys = []
for constituent in constituents:
    ys.append(constituent + '_x')
    ys.append(constituent + '_y')
    amp = df['harcon'].apply(lambda x: next(
        (item['amplitude'] for item in x if item['name'] == constituent), 0))
    phase = df['harcon'].apply(lambda x: next(
        (item['phaseLag'] for item in x if item['name'] == constituent), 0))

    sin = np.sin(phase * math.pi / 180)
    cos = np.cos(phase * math.pi / 180)

    df[constituent + '_x'] = cos * amp
    df[constituent + '_y'] = sin * amp

X = df[['lat', 'lng']]
y = df[ys]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = Sequential()
model.add(Dense(len(constituents) * 2, input_dim=2, activation='relu'))
model.add(Dense(len(constituents) * 2, activation='relu'))
model.add(Dense(1000, activation='relu'))
model.add(Dropout(rate=0.2))
model.add(Dense(len(constituents) * 2, activation='linear'))

model.compile(loss='mean_squared_error', optimizer='adam')

history = model.fit(X_train, y_train, epochs=50, verbose=1)
y_pred = model.predict(X_test)

# mse = mean_squared_error(y_test, y_pred)
newDf = pd.DataFrame(y_pred, columns=ys)
print(y_test)
print(newDf)