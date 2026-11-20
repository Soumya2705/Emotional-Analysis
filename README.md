# Toneprint

Toneprint predicts the emotion expressed in an English sentence. It runs a bidirectional GRU (BiGRU) trained in TensorFlow/Keras and uses the tokenizer saved by the training notebook. The web app shows the predicted emotion, the model’s confidence, and scores for all six labels.

> “My heart feels full of joy after hearing the good news.”
>
> The included model predicts **joy** with **97.9% confidence**. The sentence uses **11 of 66** input slots. The remaining 55 are padding.

## Run locally on Windows

1. Extract the project ZIP. In VS Code, choose **File → Open Folder** and open the `toneprint` folder containing `main.py`.
2. Open **Terminal → New Terminal**. If you trained the notebook in `emotion_env`, run these commands.

   ```shell
   conda activate emotion_env
   python -m pip install fastapi uvicorn
   python -m uvicorn main:app
   ```

3. When the terminal shows `Application startup complete`, open [Toneprint](http://127.0.0.1:8000).
4. Once **Model online** appears, type an English sentence and select **Analyze emotion** or press **Ctrl + Enter**. Press **Ctrl + C** in the terminal to stop the server.

On later runs, activate the same environment and run `python -m uvicorn main:app` from the project folder. If VS Code does not recognize `conda`, open **Anaconda Prompt** and change to the folder where you extracted the project. For example, use `cd /d "E:\Deploy\End to end project\Emotional Analysis\toneprint"`.

### Set up a fresh environment

To run the app on a new machine, open the project folder in Anaconda Prompt and run the following commands. The ZIP includes the trained model and tokenizer.

```shell
conda create -n toneprint python=3.11 -y
conda activate toneprint
python -m pip install -r requirements.txt
python -m uvicorn main:app
```

## How predictions work

1. The saved tokenizer converts the sentence into the same word IDs used during training. Unfamiliar words receive the `<unk>` ID.
2. The exported model expects **66 tokens**. The app pads shorter inputs on the right with zeros and keeps the first 66 tokens of longer inputs. The token display shows how many were used, padded, or dropped.
3. In output order, the six model scores correspond to `sadness`, `joy`, `love`, `anger`, `fear`, `surprise`. The highest score determines the predicted emotion and its confidence.

## Training and evaluation

The notebook reports **92.75% accuracy** for the BiGRU. It used the test split for both early stopping and final evaluation. To measure accuracy on a separately held-out test set in a new run, use the validation split for early stopping and evaluate on the test split once.

The notebook pads the training and test sequences to 66 tokens. Its sample prediction cell uses `maxlen=50`. To reproduce the app’s preprocessing in that cell, set `maxlen=padded_train_sequence.shape[1]` when creating `sample_padded_sequences`.

## Project files

| File | Purpose |
| --- | --- |
| `notebooks/Emotional Analysis.ipynb` | Loads the dataset, prepares the text, compares models, and exports the BiGRU and tokenizer. |
| `Models Exported/BiGRU_Modle.keras` | Stores the trained model and weights. Keep the original spelling `Modle` so the app can find it. |
| `Models Exported/tokenizer.pkl` | Stores the vocabulary and tokenization settings learned during training. |
| `predictor.py` | Converts text to model input and maps the output scores to emotion labels. |
| `main.py` | Loads the predictor at startup and serves the web page and API. |
| `static/index.html`, `static/styles.css`, `static/app.js` | Define the interface, display model status, and render the scores and token display. |

The app locates its files relative to `main.py`. You can move the project to another drive and keep the same folder structure.

## API

With the server running, select **POST /predict → Try it out** in the [interactive API docs](http://127.0.0.1:8000/docs). Enter a request body and select **Execute**.

```json
{"text": "My heart feels full of joy after hearing the good news."}
```

| Endpoint | Response |
| --- | --- |
| `GET /` | The Toneprint web page. |
| `GET /health` | `model_loaded` and `max_tokens`. |
| `POST /predict` | `text`, `predicted_emotion`, `confidence`, `probabilities`, `token_count`, `tokens_used`, and `max_tokens`. |

The API accepts 1–2,000 characters and returns HTTP `422` for invalid input, including text that produces no tokens. If the model is unavailable, `/health` and `/predict` return HTTP `503`. Check the server terminal and the two filenames in `Models Exported`.

## Credits

- The project was inspired by [Tanishq Vyas’s Emotion-Prediction](https://github.com/tanishq-latent/Emotion-Prediction).
- The training data comes from [DAIR.AI Emotion](https://huggingface.co/datasets/dair-ai/emotion).
- The app’s interface and token display were designed for this notebook. Bundled font licenses are in `static/fonts/`.
