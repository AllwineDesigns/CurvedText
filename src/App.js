import React, { Component } from 'react';
import { renderToString } from 'react-dom/server';
import textToSVG from 'text-to-svg';
import parse from 'parse-svg-path';

import TextField from '@material-ui/core/TextField';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';

import { withStyles } from '@material-ui/core/styles';

const styles = {
  card: {
    maxWidth: 900
  },
  svg: {
    border: "1px solid black",
    maxWidth: 850,
    display: "block",
    margin: "auto"
  },
  label: {
    paddingRight: 5
  }
};


class App extends Component {
  constructor() {
    super();
    this.state = {
      pathStrings: [],
      warpedPathStrings: [],
      value: "Cinnamon",
      doWarp: true,
      width: 100,
      height: 40,
      lines: 1,
      fontSizeString: ".4",
      diameterString: "1.686",
      fontSize: .4,
      diameter: 1.686,
      units: "in"
    }
  }

  componentWillMount() {
    textToSVG.load('/Times New Roman.ttf', (err, textToSVG) => {
      this.textToSVG = textToSVG;
      this.updatePathData();
    });
  }

  updatePathData = () => {
    const {
      value,
      fontSize,
      units,
      diameter
    } = this.state;

    let multiplier;

    switch(units) {
      case "cm":
        multiplier = 96/2.54;
        break;
      case "mm":
        multiplier = 96/25.4;
        break;
      default:
        multiplier = 96;
        break;
    }

    const lines = value.split("\n");

    let globalMinAngle = Number.MAX_VALUE;
    let globalMaxAngle = Number.MIN_VALUE;

    const radius = (diameter*multiplier)/2;

    const pathStrings = [];
    const centeredPathStrings = [];
    const warpedPathStrings = [];
    const pathObjs = [];
    const angleOffsets = [];

    let height = fontSize*multiplier;

    lines.forEach( (text,i) => {
      const pathString = this.textToSVG.getD(text, { x: 0, y: height, fontSize: fontSize*multiplier, anchor: "left baseline" });
      pathStrings.push(pathString);

      const obj = parse(pathString);
      pathObjs.push(obj);

      let minAngle = Number.MAX_VALUE;
      let maxAngle = Number.MIN_VALUE;

      let minY = Number.MAX_VALUE;
      let maxY = Number.MIN_VALUE;

      obj.forEach((cmd) => {
        if(cmd[0] === "Q") {
          const angle1 = cmd[1]/radius;
          if(angle1 < minAngle) {
            minAngle = angle1;
          }
          if(angle1 > maxAngle) {
            maxAngle = angle1;
          }

          const angle2 = cmd[3]/radius;
          if(angle2 < minAngle) {
            minAngle = angle2;
          }
          if(angle2 > maxAngle) {
            maxAngle = angle2;
          }

          if(cmd[2] < minY) {
            minY = cmd[2];
          }
          if(cmd[2] > maxY) {
            maxY = cmd[2];
          }
          if(cmd[4] < minY) {
            minY = cmd[4];
          }
          if(cmd[4] > maxY) {
            maxY = cmd[4];
          }
        } else if(cmd[0] === "Z") {
        } else {
          const angle = cmd[1]/radius;
          if(angle < minAngle) {
            minAngle = angle;
          }
          if(angle > maxAngle) {
            maxAngle = angle;
          }
          if(cmd[2] < minY) {
            minY = cmd[2];
          }
          if(cmd[2] > maxY) {
            maxY = cmd[2];
          }
        }
      });

      if(minAngle < globalMinAngle) {
        globalMinAngle = minAngle;
      }
      if(maxAngle > globalMaxAngle) {
        globalMaxAngle = maxAngle;
      }

      angleOffsets.push(-(minAngle+maxAngle)/2);

      height += fontSize*multiplier;
    });

    const angleOffset = -(globalMaxAngle+globalMinAngle)/2;

    // TODO - to properly calculate the warped space, we should resample the line segments and
    // quadratic bezier curves into very short linear segments. In my experience, the line segments
    // and bezier curves are short enough that I can't see a difference between a resampled curve
    // and just warping the control points/end points, but I'm only able to laser etch things under
    // 2 inches in diameter and the lettering height has been small.
    pathObjs.forEach( (obj,i) => {
      let newPath = "";
      let centeredPath = "";
      obj.forEach((oldCmd) => {
        const cmd = oldCmd.slice();
        const centeredCmd = oldCmd.slice();
        if(cmd[0] === "Q") {
          const angle1 = cmd[1]/radius+angleOffsets[i];
          cmd[1] = radius*Math.sin(angle1)-radius*angleOffset;

          const angle2 = cmd[3]/radius+angleOffsets[i];
          cmd[3] = radius*Math.sin(angle2)-radius*angleOffset;

          newPath += " " + cmd.join(" ");

          centeredCmd[1] = centeredCmd[1]+angleOffsets[i]*radius-radius*angleOffset;
          centeredCmd[3] = centeredCmd[3]+angleOffsets[i]*radius-radius*angleOffset;
          centeredPath += " " + centeredCmd.join(" ");
        } else if(cmd[0] === "Z") {
          newPath += " " + cmd.join(" ");
          centeredPath += " " + centeredCmd.join(" ");
        } else {
          const angle = cmd[1]/radius+angleOffsets[i];
          cmd[1] = radius*Math.sin(angle)-radius*angleOffset;

          newPath += " " + cmd.join(" ");

          centeredCmd[1] = centeredCmd[1]+angleOffsets[i]*radius-radius*angleOffset;
          centeredPath += " " + centeredCmd.join(" ");
        }
      });
      warpedPathStrings.push(newPath);
      centeredPathStrings.push(centeredPath);
    });
    const width = globalMaxAngle*radius-globalMinAngle*radius;
    this.setState({ pathStrings: centeredPathStrings, width, height, warpedPathStrings: warpedPathStrings });
  };

  handleDoWarp = (e, doWarp) => {
    this.setState({ doWarp });
  };

  handleFontSizeChange = (e) => {
    const fontSizeString = e.target.value;
    try {
      const fontSize = parseFloat(fontSizeString);

      if(fontSize > 0) {
        this.setState({ fontSize, fontSizeString }, this.updatePathData);
      } else {
        this.setState({ fontSizeString });
      }
    } catch(e) {
      this.setState({ fontSizeString });
    }
  };

  handleUnitsChange = (e) => {
    const {
      diameter,
      fontSize,
      units
    } = this.state;

    const newUnits = e.target.value;

    let inInchesMultiplier;
    switch(units) {
      case "mm":
        inInchesMultiplier = 1./25.4;
        break;
      case "cm":
        inInchesMultiplier = 1./2.54;
        break;
      case "in":
      default:
        inInchesMultiplier = 1;
        break;
    }

    let inUnitsMultiplier;
    switch(newUnits) {
      case "mm":
        inUnitsMultiplier = 25.4;
        break;
      case "cm":
        inUnitsMultiplier = 2.54;
        break;
      case "in":
      default:
        inUnitsMultiplier = 1;
        break;
    }

    const newDiameter = diameter*inInchesMultiplier*inUnitsMultiplier;
    const newFontSize = fontSize*inInchesMultiplier*inUnitsMultiplier;
    this.setState({ diameter: newDiameter, 
                    fontSize: newFontSize,
                    diameterString: "" + Math.round(newDiameter*100000)/100000,
                    fontSizeString: "" + Math.round(newFontSize*100000)/100000,
                    units: newUnits }, this.updatePathData);
  };

  handleDiameterChange = (e) => {
    const diameterString = e.target.value;
    try {
      const diameter = parseFloat(diameterString);

      if(diameter > 0) {
        this.setState({ diameter, diameterString }, this.updatePathData);
      } else {
        this.setState({ diameterString });
      }
    } catch(e) {
      this.setState({ diameterString });
    }
  };

  handleChange = (e) => {
    const value = e.target.value;
    const lines = value.split("\n").length;

    this.setState({ value, lines }, this.updatePathData);
  };

  handleDownloadSVG = (e) => {
    const {
      value,
      height,
      width,
      doWarp,
      warpedPathStrings,
      pathStrings
    } = this.state;
    const svg = <svg width={Math.round(width/96*1000000)/1000000 + "in"} height={Math.round(height/96*1000000)/1000000 + "in"} viewBox={"0 0 " + width + " " + height} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
        { doWarp ?
          warpedPathStrings.map((str,i) =>
          <g key={i}>
            <path d={str}/>
          </g>)
          :
          pathStrings.map((str,i) =>
          <g key={i}>
            <path d={str}/>
          </g>)
        }
        </svg>;

    const svgString = renderToString(svg);

    const element = document.createElement('a');

    element.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString));
    element.setAttribute('download', value.split("\n").join("_") + ".svg");

    element.click();

    console.log(svgString);

  };

  render() {
    const {
      classes
    } = this.props;
    const {
      pathStrings,
      warpedPathStrings,
      width,
      height,
      value,
      doWarp,
      lines,
      fontSizeString,
      diameterString,
      units
    } = this.state;
    return (
      <Card className={classes.card}>
      <CardContent>
        <div>
          <TextField fullWidth={true} multiline={true} rows={lines} value={value} onChange={this.handleChange}/>
          <FormControlLabel control={
          <TextField value={fontSizeString} onChange={this.handleFontSizeChange}/>
          } label="Font Size" labelPlacement="start" classes={ { label: classes.label } }/>

          <FormControlLabel control={
          <TextField value={diameterString} onChange={this.handleDiameterChange}/>
          } label="Diameter" labelPlacement="start" classes={ { label: classes.label } }/>

          <FormControlLabel control={
            <Select value={units} onChange={this.handleUnitsChange}>
              <MenuItem value="in">Inches</MenuItem>
              <MenuItem value="mm">Millimeters</MenuItem>
              <MenuItem value="cm">Centimeters</MenuItem>
            </Select>
          } label="Units" labelPlacement="start" classes={ { label: classes.label } }/>

          <FormControlLabel control={
          <Switch checked={doWarp} onChange={this.handleDoWarp} color="primary"/>
          } label="Do Warp"/>

        </div>
        <br/>
        <div>
        <svg preserveAspectRatio="xMidYMin" className={classes.svg} height={height*3} viewBox={"0 0 " + width + " " + height}>
        { doWarp ?
          warpedPathStrings.map((str,i) =>
          <g key={i}>
            <path d={str}/>
          </g>)
          :
          pathStrings.map((str,i) =>
          <g key={i}>
            <path d={str}/>
          </g>)
        }
        </svg>
        </div>
      </CardContent>
      <CardActions>
        <Button variant="raised" color="primary" onClick={this.handleDownloadSVG}>Download SVG</Button>
      </CardActions>
      </Card>
    );
  }
}

export default withStyles(styles)(App);
