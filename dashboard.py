from src.ui import theme_manager, ImageViewer, LoadingUI, SkeletonCard
from src.core import ProgressClassifier
import panel as pn
import torch
from PIL import Image
import io
import os
import time

# Configure Panel Extension and Theme Integration
theme_manager.apply_to_app()
pn.extension(
    css_files=['static/css/image_viewer.css', 'static/css/loading.css'],
    js_files={
        'image_viewer': 'static/js/image_viewer.js',
        'progress_tracker': 'static/js/progress_tracker.js'
    }
)

# Load Model using Core Classifier
classifier = ProgressClassifier()

# Save image function
def save_image(image_obj, predicted_class, image_name="uploaded_image.jpg"):
    save_dir = f"data/train/{predicted_class}"
    os.makedirs(save_dir, exist_ok=True)
    image_path = os.path.join(save_dir, image_name)
    image_obj.save(image_path)

# UI Components
image_input = pn.widgets.FileInput(accept='image/*')
output = pn.pane.Markdown("Upload an image of food 🍲")
image_preview = ImageViewer(visible=False)
loading_overlay = LoadingUI(visible=False)

# Theme Toggle
theme_toggle = theme_manager.get_header_toggle_btn()

def update_progress(percent, message):
    loading_overlay.progress = percent
    loading_overlay.message = message
    time.sleep(0.1)  # small pause to yield thread for UI updates

def classify(event=None):
    if image_input.value is None:
        output.object = "⚠️ Please upload an image first."
        image_preview.visible = False
        return
    
    try:
        loading_overlay.visible = True
        output.object = "⏳ Starting analysis..."
        
        # Run classification with progress updates
        predicted_class, image = classifier.classify_with_progress(
            image_input.value, 
            progress_callback=update_progress
        )

        # Update preview
        image_preview.object = image
        image_preview.visible = True

        # Save result
        save_image(image, predicted_class)
        output.object = f"✅ Identified as **{predicted_class}**. Result saved!"
        
    except Exception as e:
        output.object = f"❌ Error: {str(e)}"
    finally:
        loading_overlay.visible = False

run_button = pn.widgets.Button(name='Classify Dish 🍽️', button_type='primary', height=45)
run_button.on_click(classify)

# Header
header = pn.Row(
    pn.pane.Markdown("# 🍽️ FlavorSnap", styles={'margin-top': '0px', 'flex': '1'}),
    theme_toggle,
    sizing_mode='stretch_width',
    css_classes=['header']
)

# Main Dashboard Area
dashboard_body = pn.Column(
    pn.pane.Markdown("### Upload an image and let FlavorSnap identify it in seconds. 🥗", styles={'font-size': '1.1rem'}),
    pn.Row(
        pn.Column(
            pn.pane.Markdown("#### Controls"),
            image_input, 
            run_button,
            loading_overlay, # Component for loading overlay
            width=300
        ),
        pn.Column(
            pn.pane.Markdown("#### Preview & Results"),
            image_preview, 
            output,
            sizing_mode='stretch_width'
        ),
        sizing_mode='stretch_width'
    ),
    sizing_mode='stretch_width',
    css_classes=['dashboard-container']
)

# App Assembly
app = pn.Column(
    header,
    pn.layout.Divider(),
    dashboard_body,
    sizing_mode='stretch_width'
)

app.servable()
