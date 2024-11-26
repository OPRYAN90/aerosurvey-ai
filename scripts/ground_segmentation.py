import numpy as np
import laspy
import json
import sys
from typing import Dict, List, Union, Optional
import random
from pathlib import Path
import time
import gc
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # Send logs to stderr instead of stdout
)

class SimpleGroundClassifier:
    def __init__(self, laz_file_path: str):
        self.laz_file_path = laz_file_path
        self.las_data = None
        self.total_points = 0
        self.chunk_size = 10_000_000
        
    def load_file(self) -> None:
        try:
            if not Path(self.laz_file_path).exists():
                raise FileNotFoundError(f"File not found: {self.laz_file_path}")
                
            self.las_data = laspy.read(self.laz_file_path)
            self.total_points = len(self.las_data.points)
            
            if self.total_points == 0:
                raise ValueError("Point cloud contains no points")
                
            logging.info(f"Loaded point cloud with {self.total_points:,} points")
            
        except Exception as e:
            logging.error(f"Error loading file: {str(e)}")
            raise
            
    def process_chunks(self) -> Dict[str, List[Dict[str, float]]]:
        ground_points = []
        non_ground_points = []
        
        total_chunks = (self.total_points + self.chunk_size - 1) // self.chunk_size
        
        for chunk_idx, chunk_start in enumerate(range(0, self.total_points, self.chunk_size)):
            chunk_end = min(chunk_start + self.chunk_size, self.total_points)
            chunk_size = chunk_end - chunk_start
            
            logging.info(f"Processing chunk {chunk_idx + 1}/{total_chunks}")
            
            # Get coordinates for this chunk
            x = self.las_data.x[chunk_start:chunk_end]
            y = self.las_data.y[chunk_start:chunk_end]
            z = self.las_data.z[chunk_start:chunk_end]
            
            chunk_mask = np.random.choice(
                [True, False],
                size=chunk_size,
                p=[0.5, 0.5]
            )
            
            # Create point dictionaries with coordinates
            for i in range(chunk_size):
                point = {
                    "x": float(x[i]),
                    "y": float(y[i]),
                    "z": float(z[i])
                }
                if chunk_mask[i]:
                    ground_points.append(point)
                else:
                    non_ground_points.append(point)
            
            gc.collect()
            
        return {
            "ground": ground_points,
            "nonGround": non_ground_points
        }

    def classify_ground(self) -> Dict[str, Union[List[Dict[str, float]], Dict[str, Union[int, str, float]]]]:
        start_time = time.time()
        
        if not self.las_data:
            self.load_file()
        
        try:
            logging.info("Starting ground classification")
            classification = self.process_chunks()
            processing_time = time.time() - start_time
            
            result = {
                "metadata": {
                    "totalPoints": self.total_points,
                    "groundPoints": len(classification["ground"]),
                    "nonGroundPoints": len(classification["nonGround"]),
                    "fileProcessed": str(Path(self.laz_file_path).name),
                    "processingTimeSeconds": round(processing_time, 2),
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "chunkSize": self.chunk_size,
                    "success": True
                },
                "classification": classification
            }
            
            return result
            
        except Exception as e:
            logging.error(f"Classification failed: {str(e)}")
            return {
                "metadata": {
                    "success": False,
                    "error": str(e),
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                },
                "classification": {"ground": [], "nonGround": []}
            }

def main():
    if len(sys.argv) != 2:
        error = {
            "metadata": {
                "success": False,
                "error": "Invalid arguments. Usage: python ground_segmentation.py <laz_file_path>",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        print(json.dumps(error))  # Only JSON output goes to stdout
        sys.exit(1)
    
    try:
        laz_file_path = sys.argv[1]
        classifier = SimpleGroundClassifier(laz_file_path)
        result = classifier.classify_ground()
        print(json.dumps(result))  # Only JSON output goes to stdout
        sys.exit(0 if result["metadata"]["success"] else 1)
        
    except Exception as e:
        error = {
            "metadata": {
                "success": False,
                "error": str(e),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        print(json.dumps(error))  # Only JSON output goes to stdout
        sys.exit(1)

if __name__ == "__main__":
    main()